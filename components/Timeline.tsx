"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ImportEntry from "./ImportEntry";
import ThemeCard from "./ThemeCard";
import type { Identity } from "@/lib/auth";
import type { Post, Visibility } from "@/lib/types";

const SHARED_QUESTION = "新しいことを始めるか迷っている。最初の一歩をどう決めたらいい？";

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
function defaultFutureDate(at: string): string {
  const d = new Date(at);
  d.setUTCFullYear(d.getUTCFullYear() + 10);
  return d.toISOString().slice(0, 10);
}

type Mode = "live" | "mock" | null;

export default function Timeline({ initialNow }: { initialNow: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [now, setNow] = useState<string>(initialNow);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string>("guest");
  const viewerRef = useRef(me);
  viewerRef.current = me;
  const [filter, setFilter] = useState<string>("");
  const [feed, setFeed] = useState<"past" | "future" | "all">("past");
  const [todayRequest, setTodayRequest] = useState(0);
  const [futureRequest, setFutureRequest] = useState(0);
  const [comparison, setComparison] = useState<{ past?: Post; future?: Post }>({});
  const [guidedPost, setGuidedPost] = useState<{ id: string; request: number } | null>(null);
  const [lastMode, setLastMode] = useState<Mode>(null);
  const nowRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/timeline?viewer=${encodeURIComponent(me)}`, { cache: "no-store" });
      const data = (await res.json()) as { posts: Post[]; now: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      if (viewerRef.current !== me) return;
      setPosts(data.posts);
      setNow(data.now);
      setError(null);
    } catch (e) {
      if (viewerRef.current === me) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (viewerRef.current === me) setLoading(false);
    }
  }, [me]);

  useEffect(() => { setMounted(true); load(); }, [load]);
  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error("ログイン情報を取得できません");
      return await res.json() as Identity;
    }).then((user) => { setIdentity(user); if (user.enabled && user.id !== viewerRef.current) { viewerRef.current = user.id; setPosts([]); setMe(user.id); } })
      .catch((e) => setError(e.message));
  }, []);


  const authors = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of posts) if (!p.aiGenerated && p.author !== "you") m.set(p.author, p.authorName);
    const list = [...m].map(([author, authorName]) => ({ author, authorName }));
    return list.length ? list : AUTHORS_FALLBACK;
  }, [posts]);
  const meName = identity?.enabled ? identity.name : me === "guest" ? "ゲスト" : authors.find((a) => a.author === me)?.authorName ?? me;

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
    setFeed(year > nowYear ? "future" : "past");
    setTimeout(() => {
      const el = document.getElementById(`year-${year}`) ?? document.getElementById("feed");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const revealPost = (post: Post) => {
    setFilter("");
    setFeed(Date.parse(post.at) > Date.parse(now) ? "future" : "past");
    setTimeout(() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  const startPast = () => {
    const candidates = posts.filter((p) => !p.replyTo && !p.aiGenerated && !p.locked && Date.parse(p.at) <= Date.parse(now));
    const own = candidates.filter((p) => p.author === me);
    const target = own.find((p) => p.id === "keitaro-2023-02") ?? own[0] ?? candidates.find((p) => p.id === "keitaro-2023-02") ?? candidates[0];
    if (target) { setGuidedPost((prev) => ({ id: target.id, request: (prev?.request ?? 0) + 1 })); revealPost(target); }
  };

  const onReplied = (human: Post, ai: Post, mode: Mode) => {
    if (human.author !== viewerRef.current) return;
    setPosts((prev) => [...prev, human, ai]);
    if (human.text === SHARED_QUESTION && ai.author === viewerRef.current) setComparison((prev) => ({ ...prev, past: ai }));
    setLastMode(mode);
  };
  const onPosted = (post: Post, ai: Post | null, mode: Mode) => {
    if (post.author !== viewerRef.current) return;
    setPosts((prev) => (ai ? [...prev, post, ai] : [...prev, post]));
    setLastMode(mode);
    if (post.text === SHARED_QUESTION && ai) setComparison((prev) => ({ ...prev, future: ai }));
    setFilter("");
    setNow(new Date(Math.max(Date.now(), post.kind === "future" ? 0 : Date.parse(post.at))).toISOString());
    setFeed(post.kind === "future" ? "future" : "past");
    setTimeout(() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const pairReady = comparison.past?.author === me && comparison.future?.author === me;

  return (
    <>
    <header className="tw-header">
      <a href="#welcome" className="tw-brand"><img className="tw-logo" src="/timetalk-mark.svg" alt="" width={36} height={36} />タイムトーク<span className="tw-wordmark">Time Talk</span></a>
      <span className="tw-header-note">思考が時を超えるSNS</span>
      <button className="tw-header-action" onClick={() => pairReady ? document.getElementById("compare-replies")?.scrollIntoView({ behavior: "smooth", block: "center" }) : nowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>{pairReady ? "返事を比べる" : "思いを書く"}</button>
    </header>
    <div className="tw-shell">
      <nav className="tw-nav" aria-label="年ジャンプ">
        <p className="tw-nav-title">時間を旅する</p>
        <p className="sub">年を選んで移動</p>
        <div className="dir">↑ 未来</div>
        {[...new Set([...yearsPresent, nowYear, nowYear + 10])].sort((a, b) => b - a).map((y) => (
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
        <section className="tw-welcome" id="welcome">
          <h1>迷ったとき、時間を超えて自分と話す。</h1>
          <p className="tw-intro">新しい一歩に迷うあなたへ。昔の記録から大切にしていたことを見つけ、未来の視点で今日の選択を考える。</p>
          <details className="tw-guide"><summary>使い方 · 過去と未来を比べてみる</summary><div className="tw-journey" aria-label="同じ問いを過去と未来へ">
            {identity && !identity.enabled && <button className="tw-demo-start" onClick={() => { viewerRef.current = "keitaro"; setPosts([]); setLoading(true); setMe("keitaro"); setFilter("keitaro"); setGuidedPost(null); }} disabled={me === "keitaro"}>{me === "keitaro" ? "けいたろうのサンプルを選択中" : "けいたろうのサンプルで比べる"}</button>}
            <p>「{SHARED_QUESTION}」</p>
            <div>
              <button disabled={loading || !posts.some((p) => !p.locked && !p.replyTo && Date.parse(p.at) <= Date.parse(now))} onClick={startPast}><strong>1 · 過去に聞く</strong><span>当時までの記録で、あの頃の視点を再現</span></button>
              <button onClick={() => { setDraft(SHARED_QUESTION); setFutureRequest((n) => n + 1); nowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("post-text")?.focus(); }}><strong>2 · 未来に聞く</strong><span>今までの記録で、これからの選択を考える</span></button>
            </div>
            <small>サンプルで試す場合は、投稿欄の「体験するユーザー」を選べます。AIの返事は再現・推定です。</small>
          </div></details>
          {pairReady && <section className="tw-comparison" id="compare-replies" aria-label="過去と未来の返事を比較">
            <h2>同じ問い。違う時間の、ふたつの視点。</h2>
            <div>
              {[comparison.past!, comparison.future!].map((reply, index) => <article key={reply.id}>
                <h3>{yearOf(reply.at)}年 · {index === 0 ? "当時の視点" : "未来の視点"}</h3>
                <p>{reply.text}</p>
                <SourceRecords reply={reply} records={posts} onReveal={revealPost} />
              </article>)}
            </div>
            <p className="tw-help">どちらの言葉が、今のあなたに響きましたか。大切にしたいことをひとつ選んで、今日の小さな一歩へ。</p>
            <button className="tw-next-step" onClick={() => { setDraft("今日の小さな一歩：\n\n大切にしたいこと："); setTodayRequest((n) => n + 1); nowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("post-text")?.focus(); }}>今日の一歩を自分の言葉で残す</button>
          </section>}
        </section>

        <div className="tw-now" ref={nowRef} id="now">
          <div className="tw-now-label">NOW · 今</div>
          <h2>いま、どんなことを考えてる？</h2>
          <div className="stamp">{mounted ? fmtAt(now) : "日時を読み込み中…"}</div>
          <div className="row tw-auth">
            <span>{identity?.authenticated ? "ログイン中：けいたろう" : "ゲストモード"}</span>
            {identity?.enabled && (identity.authenticated
              ? <form action="/auth/logout" method="post"><button type="submit">ログアウト</button></form>
              : <a href="/auth/login">Google でログイン</a>)}
          </div>
          <FutureComposer todayRequest={todayRequest} futureRequest={futureRequest} initialDate={defaultFutureDate(initialNow)} text={draft} setText={setDraft} me={me} meName={meName} onPosted={onPosted} />
          <details className="tw-account-settings"><summary>投稿者：{meName}{!identity?.enabled && " · サンプルを変更"}</summary><div className="row">
            <label>
              {identity?.enabled ? "投稿者:" : "体験するユーザー:"}{" "}
              <select disabled={identity?.enabled ?? false} value={me} onChange={(e) => { viewerRef.current = e.target.value; setPosts([]); setLoading(true); setMe(e.target.value); }}>
                <option value={identity?.enabled ? identity.id : "guest"}>{identity?.enabled ? identity.name : "ゲスト"}</option>
                {!identity?.enabled && authors.filter((a) => a.author !== "guest").map((a) => <option key={a.author} value={a.author}>{a.authorName}</option>)}
              </select>
            </label>

            {lastMode && (
              <span className={`tw-badge ${lastMode === "mock" ? "mock" : "human"}`}>
                AI: {lastMode === "mock" ? "モック応答" : "Claude"}
              </span>
            )}
          </div></details>
          {error && <p className="tw-error" role="alert">{error}</p>}
        </div>

        <details className="tw-tools">
          <summary>今日のテーマ・過去の記録を取り込む</summary>
          <ImportEntry />
          <ThemeCard onSelect={(theme) => {
            setDraft(`${theme}\n\n`);
            document.getElementById("post-text")?.focus();
          }} />
          <p className="tw-help">未来の返事は今ここで生成されます。公開時期は、他の人が本文を読めるようになる日時です。</p>
        </details>
        {identity && !identity.enabled && <aside className="tw-demo" aria-label="デモデータの説明">
          <span className="tw-demo-tag">DEMO</span>
          <div><strong>3人の手書きサンプルで体験中</strong><p>実際のSNSから取り込んだ投稿ではありません。</p></div>
        </aside>}
        <div className="tw-feed-filter"><label>表示する投稿 <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">全員</option>{authors.map((a) => <option key={a.author} value={a.author}>{a.authorName}</option>)}</select></label></div>
        <nav className="tw-feed-tabs" id="feed" aria-label="時間の切替">
          <button aria-pressed={feed === "past"} onClick={() => setFeed("past")}>過去と今</button>
          <button aria-pressed={feed === "future"} onClick={() => setFeed("future")}>未来</button>
          <button aria-pressed={feed === "all"} onClick={() => setFeed("all")}>すべて</button>
        </nav>
        {loading && <p className="tw-empty">読み込み中…</p>}
        {feed !== "past" && <>
          {!loading && future.length === 0 && <p className="tw-empty">未来への最初のひと言を。上の投稿欄から、未来の自分に話しかけてみましょう。</p>}
          {renderList(future, "future")}
        </>}
        {feed !== "future" && <>
          {!loading && past.length === 0 && <p className="tw-empty">まだ投稿がありません。上の投稿欄から思いを残してみましょう。</p>}
          {renderList(past, "past")}
        </>}
        <footer className="tw-footer">タイムトーク · 思考が時を超えるSNS<br /><span>AIの返事は、記録をもとにした再現・推定です。</span></footer>
      </main>
    </div>
    </>
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
        <PostCard key={p.id} post={p} side={side} thread={threads.get(p.id) ?? []} me={me} meName={meName} onReplied={onReplied} records={posts} onReveal={revealPost} guided={guidedPost?.id === p.id ? guidedPost.request : 0} />,
      );
    }
    return out;
  }
}

function PostCard(props: {
  post: Post; side: "future" | "past"; thread: Post[]; me: string; meName: string;
  onReplied: (human: Post, ai: Post, mode: Mode) => void;
  records: Post[]; onReveal: (post: Post) => void; guided: number;
}) {
  const { post, side, thread } = props;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canReply = side === "past" && !post.locked;
  useEffect(() => { if (props.guided && canReply) { setOpen(true); setText(SHARED_QUESTION); } }, [props.guided, canReply]);

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

  if (post.locked) return (
    <article className={`tw-card ${side} tw-locked`} id={`post-${post.id}`}>
      <p>{lockedLabel(post)}</p>
    </article>
  );

  return (
    <article className={`tw-card ${side}`} id={`post-${post.id}`}>
      <div className="meta">
        <span className="tw-avatar" aria-hidden="true">{post.authorName.slice(0, 1)}</span><span className="name">{post.authorName}</span>
        <span className="at">{fmtAt(post.at)}</span>
        <span className={`tw-badge ${side}`}>{side === "future" ? "未来宛て" : "過去の思考"}</span>
      </div>
      <p className="text">{post.text}</p>
      {(post.visibility !== "public" || post.unlockAt) && <p className="tw-access-note">
        {post.visibility === "private" ? "自分だけ" : post.visibility === "friends" ? "友人に公開" : "公開"}
        {post.unlockAt && ` · ${fmtAt(post.unlockAt)}に解禁`}
      </p>}
      {canReply && (
        <div className="actions">
          <button onClick={() => setOpen((v) => !v)}>{open ? "閉じる" : "この時点に返信"}</button>
        </div>
      )}
      {open && (
        <form className="tw-reply-form" onSubmit={submit}>
          <p className="tw-help">この投稿の時点までの記録をもとに、当時の視点で答えます。本人の実際の返事ではありません。</p>
          <button type="button" disabled={busy} onClick={() => setText("その一歩を踏み出すとき、何がいちばん不安だった？")}>質問例を入れる</button>
          <textarea maxLength={2000} aria-label="過去への返信本文" value={text} onChange={(e) => setText(e.target.value)} placeholder={`${yearOf(post.at)}年の${post.authorName}に話しかける…`} disabled={busy} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="primary" type="submit" disabled={busy || !text.trim()}>{busy ? "当時の本人を再現中…" : "送る"}</button>
            {busy && <span className="tw-thinking">{yearOf(post.at)}年の{post.authorName}が考えています</span>}
            {err && <span className="tw-error" role="alert">{err}</span>}
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
              <div>{r.locked ? lockedLabel(r) : r.text}</div>
              {r.aiGenerated && !r.locked && <SourceRecords reply={r} records={props.records} onReveal={props.onReveal} /> }
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function SourceRecords({ reply, records, onReveal }: { reply: Post; records: Post[]; onReveal: (post: Post) => void }) {
  const ids = reply.sourcePostIds;
  if (!ids) return <p className="tw-source-note">以前の返答のため、参照記録の一覧は保存されていません。</p>;
  const sources = ids.map((id) => records.find((p) => p.id === id)).filter((p): p is Post => Boolean(p && !p.locked));
  return <details className="tw-sources">
    <summary>{reply.aiMode === "mock" ? "モックに渡した記録" : "AIに渡した記録"} · {ids.length}件</summary>
    <p>{reply.kind === "future" ? "生成時点までの公開履歴を参考にした、未来の視点の提案です。未来の出来事の予言ではありません。" : "この投稿の時点までの記録だけを渡しています。それ以降の出来事は含みません。"} すべてを引用したことを示す一覧ではありません。</p>
    {ids.length === 0 && <p>過去の記録がないため、今回の問いだけで答えています。ユーザーを選ぶと、サンプルの履歴で体験できます。</p>}
    {sources.map((p) => <button key={p.id} onClick={() => onReveal(p)}><span>{fmtAt(p.at)} · {p.authorName}</span><q>{p.text.slice(0, 180)}{p.text.length > 180 ? "…" : ""}</q></button>)}
    {sources.length < ids.length && <p>現在閲覧できない記録は表示していません。</p>}
  </details>;
}

function lockedLabel(post: Post): string {
  if (post.unlockAt && Date.parse(post.unlockAt) > Date.now()) {
    return `🔒 ${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long" }).format(new Date(post.unlockAt))}に公開`;
  }
  return post.visibility === "private" ? "🔒 非公開の思考" : "🔒 友人に公開された思考";
}

function FutureComposer(props: { todayRequest: number; futureRequest: number; initialDate: string; text: string; setText: (text: string) => void; me: string; meName: string; onPosted: (post: Post, ai: Post | null, mode: Mode) => void }) {
  const [intent, setIntent] = useState<"now" | "future">("now");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [unlockYears, setUnlockYears] = useState(0);
  const [date, setDate] = useState(props.initialDate);
  useEffect(() => { if (props.futureRequest) { setIntent("future"); setDate(props.initialDate); } }, [props.futureRequest, props.initialDate]);
  useEffect(() => { if (props.todayRequest) setIntent("now"); }, [props.todayRequest]);
  const isFutureDate = intent === "future";
  const { text, setText } = props;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const unlock = new Date();
      unlock.setUTCFullYear(unlock.getUTCFullYear() + unlockYears);
      const unlockAt = unlockYears ? unlock.toISOString() : undefined;
      const at = intent === "future" ? new Date(`${date}T09:00:00+09:00`).toISOString() : undefined;
      if (at && Date.parse(at) <= Date.now()) throw new Error("未来の日付を選んでください。今の思いを残す場合は「今の記録」を選べます。");
      const res = await fetch("/api/post", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ author: props.me, authorName: props.meName, text, at, visibility, unlockAt }),
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

  const accessLabel = visibility === "private" ? "自分だけ" : `${visibility === "friends" ? "友人に公開" : "全員に公開"}${unlockYears ? ` · ${unlockYears}年後から` : " · 今すぐ"}`;
  return (
    <form className="tw-composer" onSubmit={submit}>
      <div className="tw-compose-intent" aria-label="投稿の種類">
        <button type="button" aria-pressed={intent === "now"} disabled={busy} onClick={() => setIntent("now")}>今の記録</button>
        <button type="button" aria-pressed={intent === "future"} disabled={busy} onClick={() => setIntent("future")}>未来の自分に聞く</button>
      </div>
      <textarea maxLength={2000} id="post-text" aria-label="投稿本文" value={text} onChange={(e) => setText(e.target.value)} placeholder={isFutureDate ? "未来の自分に聞きたいことは？" : "いま、何を考えていますか？"} disabled={busy} />
      {isFutureDate && <div className="tw-future-options">
        <details>
          <summary>{date ? `${yearOf(`${date}T09:00:00+09:00`)}年の自分に聞く` : "話しかける日付を選ぶ"} · 変更</summary>
          <label>どの時点の自分に聞く？ <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} /></label>
        </details>
        <p>その年の視点を想像したAIの返事が、今すぐ届きます。</p>
        <button type="button" disabled={busy} onClick={() => setText("今、新しいことを始めるか迷っている。10年後の自分なら、この一歩をどう考える？")}>質問例を入れる</button>
      </div>}
      <div className="tw-compose-bottom">
        <details className="tw-publish-settings">
          <summary>公開設定 · {accessLabel}</summary>
          <div>
            <label>誰に見せる？ <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} disabled={busy}>
              <option value="public">全員</option><option value="friends">友人（デモ）</option><option value="private">自分だけ</option>
            </select></label>
            {visibility !== "private" && <label>他の人に見せるのは？ <select value={unlockYears} onChange={(e) => setUnlockYears(Number(e.target.value))} disabled={busy}>
              <option value={0}>今すぐ</option>{[1,3,5,10].map((y) => <option key={y} value={y}>{y}年後から</option>)}
            </select></label>}
            <p>{visibility === "private" ? "あなたが選択しているユーザーだけが本文を読めます。ゲストは共有デモです。" : "指定した時期まで、他の人には鍵付きの表示だけが見えます。"}{isFutureDate && " AIの返事が届くタイミングは変わりません。"}</p>
          </div>
        </details>
        <button className="primary" type="submit" disabled={busy || !text.trim()}>{busy ? (isFutureDate ? "返事を考えています…" : "保存中…") : isFutureDate ? "未来の自分に聞く" : "投稿する"}</button>
      </div>
      {busy && <p className="tw-thinking" role="status">{isFutureDate ? "これまでの記録から、未来の視点を考えています" : "記録を保存しています"}</p>}
      {err && <p className="tw-error" role="alert">{err}</p>}
    </form>
  );
}
