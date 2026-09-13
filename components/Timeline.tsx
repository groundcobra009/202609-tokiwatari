"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@/lib/types";

const YEARS = Array.from({ length: 21 }, (_, i) => 2016 + i); // 2016..2036
const AUTHORS_FALLBACK = [{ author: "keitaro", authorName: "けいたろう" }];

function yearOf(at: string): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date(at)));
}
function fmtAt(at: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(at));
}
function defaultFutureDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString().slice(0, 10);
}

type Mode = "live" | "mock" | null;

export default function Timeline() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [now, setNow] = useState<string>(new Date().toISOString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string>("keitaro");
  const [filter, setFilter] = useState<string>("");
  const [lastMode, setLastMode] = useState<Mode>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const scrolledOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/timeline", { cache: "no-store" });
      const data = (await res.json()) as { posts: Post[]; now: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setPosts(data.posts);
      setNow(data.now);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && !scrolledOnce.current && nowRef.current) {
      scrolledOnce.current = true;
      nowRef.current.scrollIntoView({ block: "center" });
    }
  }, [loading]);

  const authors = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of posts) if (!p.aiGenerated && p.author !== "you") m.set(p.author, p.authorName);
    const list = [...m].map(([author, authorName]) => ({ author, authorName }));
    return list.length ? list : AUTHORS_FALLBACK;
  }, [posts]);
  const meName = authors.find((a) => a.author === me)?.authorName ?? me;

  // 親投稿（replyTo なし）を未来→過去の順に。返信は親にぶら下げる
  const { future, past, threads } = useMemo(() => {
    const threads = new Map<string, Post[]>();
    const roots: Post[] = [];
    for (const p of posts) {
      if (filter && p.author !== filter && !p.replyTo) continue;
      if (p.replyTo) {
        if (!threads.has(p.replyTo)) threads.set(p.replyTo, []);
        threads.get(p.replyTo)!.push(p);
      } else roots.push(p);
    }
    for (const list of threads.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const nowT = new Date(now).getTime();
    const desc = [...roots].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return {
      future: desc.filter((p) => new Date(p.at).getTime() > nowT),
      past: desc.filter((p) => new Date(p.at).getTime() <= nowT),
      threads,
    };
  }, [posts, now, filter]);

  const yearsPresent = useMemo(() => new Set(posts.map((p) => yearOf(p.at))), [posts]);
  const nowYear = yearOf(now);

  const jump = (year: number) => {
    if (year === nowYear) {
      nowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const el = document.getElementById(`year-${year}`) ?? nowRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onReplied = (human: Post, ai: Post, mode: Mode) => {
    setPosts((prev) => [...prev, human, ai]);
    setLastMode(mode);
  };
  const onPosted = (post: Post, ai: Post | null, mode: Mode) => {
    setPosts((prev) => (ai ? [...prev, post, ai] : [...prev, post]));
    setLastMode(mode);
    setTimeout(() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  return (
    <div className="tw-shell">
      <nav className="tw-nav" aria-label="年ジャンプ">
        <h1>時渡り</h1>
        <p className="sub">思考が時を超えるSNS</p>
        <div className="dir">↑ 未来</div>
        {[...YEARS].reverse().map((y) => (
          <button
            key={y}
            className={y === nowYear ? "now" : y > nowYear ? "future" : "past"}
            onClick={() => jump(y)}
            style={{ opacity: yearsPresent.has(y) || y === nowYear ? 1 : 0.4 }}
          >
            {y === nowYear ? `${y} 今` : y}
          </button>
        ))}
        <div className="dir">↓ 過去</div>
      </nav>

      <main className="tw-main">
        <div className="tw-top">ここより先はまだ誰も書いていない未来</div>

        {future.length === 0 && <p className="tw-empty">未来にはまだ投稿がありません。「今」の線から未来へ投稿してみてください。</p>}
        {renderList(future, "future")}

        <div className="tw-now" ref={nowRef} id="now">
          <h2>今</h2>
          <div className="stamp">{fmtAt(now)}</div>
          <FutureComposer me={me} meName={meName} onPosted={onPosted} />
          <div className="row" style={{ marginTop: 10 }}>
            <label>
              わたし:{" "}
              <select value={me} onChange={(e) => setMe(e.target.value)}>
                {authors.map((a) => <option key={a.author} value={a.author}>{a.authorName}</option>)}
              </select>
            </label>
            <label>
              表示:{" "}
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">全員</option>
                {authors.map((a) => <option key={a.author} value={a.author}>{a.authorName}</option>)}
              </select>
            </label>
            {lastMode && (
              <span className={`tw-badge ${lastMode === "mock" ? "mock" : "human"}`}>
                AI: {lastMode === "mock" ? "モック応答" : "Claude"}
              </span>
            )}
            {error && <span className="tw-error">{error}</span>}
          </div>
        </div>

        {loading && <p className="tw-empty">読み込み中…</p>}
        {!loading && past.length === 0 && <p className="tw-empty">過去の投稿がありません。`npm run seed` で種を投入してください。</p>}
        {renderList(past, "past")}
      </main>
    </div>
  );

  function renderList(list: Post[], side: "future" | "past") {
    const out: React.ReactNode[] = [];
    let lastYear: number | null = null;
    for (const p of list) {
      const y = yearOf(p.at);
      if (y !== lastYear) {
        out.push(<div key={`y-${side}-${y}`} id={`year-${y}`} className={`tw-year ${side}`}>{y}</div>);
        lastYear = y;
      }
      out.push(
        <PostCard key={p.id} post={p} side={side} thread={threads.get(p.id) ?? []} me={me} meName={meName} onReplied={onReplied} />,
      );
    }
    return out;
  }
}

function PostCard(props: {
  post: Post; side: "future" | "past"; thread: Post[]; me: string; meName: string;
  onReplied: (human: Post, ai: Post, mode: Mode) => void;
}) {
  const { post, side, thread } = props;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canReply = side === "past";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/reply", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, text, author: props.me, authorName: props.meName }),
      });
      const data = (await res.json()) as { reply: Post; aiReply: Post; mode: Mode; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      props.onReplied(data.reply, data.aiReply, data.mode);
      setText(""); setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`tw-card ${side}`} id={`post-${post.id}`}>
      <div className="meta">
        <span className="name">{post.authorName}</span>
        <span className="at">{fmtAt(post.at)}</span>
        <span className={`tw-badge ${side}`}>{side === "future" ? "未来宛て" : "過去の思考"}</span>
      </div>
      <p className="text">{post.text}</p>
      {canReply && (
        <div className="actions">
          <button onClick={() => setOpen((v) => !v)}>{open ? "閉じる" : "この時点に返信"}</button>
        </div>
      )}
      {open && (
        <form className="tw-reply-form" onSubmit={submit}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={`${yearOf(post.at)}年の${post.authorName}に話しかける…`} disabled={busy} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="primary" type="submit" disabled={busy || !text.trim()}>{busy ? "当時の本人を再現中…" : "送る"}</button>
            {busy && <span className="tw-thinking">{yearOf(post.at)}年の{post.authorName}が考えています</span>}
            {err && <span className="tw-error">{err}</span>}
          </div>
        </form>
      )}
      {thread.length > 0 && (
        <div className="tw-thread">
          {thread.map((r) => (
            <div key={r.id} className={`item ${r.aiGenerated ? "ai" : ""}`}>
              <div className="meta">
                <span>{r.authorName}</span>
                {r.aiGenerated ? (
                  <span className={`tw-badge ${side}`}>{side === "future" ? "未来の自分（AI推定）" : "当時の本人（AI再現）"}</span>
                ) : (
                  <span className="tw-badge human">{fmtAt(r.createdAt)} に送信</span>
                )}
              </div>
              <div>{r.text}</div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function FutureComposer(props: { me: string; meName: string; onPosted: (post: Post, ai: Post | null, mode: Mode) => void }) {
  const [date, setDate] = useState(defaultFutureDate());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const at = new Date(`${date}T09:00:00+09:00`).toISOString();
      const res = await fetch("/api/post", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ author: props.me, authorName: props.meName, text, at }),
      });
      const data = (await res.json()) as { post?: Post; aiReply: Post | null; mode: Mode; error?: string };
      if (!data.post) throw new Error(data.error ?? res.statusText);
      props.onPosted(data.post, data.aiReply, data.mode);
      if (data.error) setErr(data.error);
      setText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="未来の自分へ。いま考えていること、迷っていること…" disabled={busy} />
      <div className="row">
        <label>宛先の日付: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} /></label>
        <button className="primary" type="submit" disabled={busy || !text.trim()}>{busy ? "未来の自分を推定中…" : "未来へ投稿"}</button>
        {busy && <span className="tw-thinking">{yearOf(`${date}T00:00:00+09:00`)}年の{props.meName}から返事を待っています</span>}
        {err && <span className="tw-error">{err}</span>}
      </div>
    </form>
  );
}
