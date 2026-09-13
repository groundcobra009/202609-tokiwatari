#!/usr/bin/env node
// ゴールコマンドの一部。dev サーバーを起動し、HTTP で3点を検証する
//   ① /api/seed に種投入 ② /api/reply で過去投稿へ返信 → aiGenerated:true の返答
//   ③ 未来宛て投稿 → /api/timeline の未来領域に載る
// ANTHROPIC_API_KEY が無い（または MOCK_AI=1）ときはモック応答で通る。どちらだったかを出力する
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.SMOKE_PORT || 3939);
const BASE = process.env.SMOKE_BASE || `http://localhost:${PORT}`;
const SEED = path.resolve(process.cwd(), "seed/sample.json");
const externalServer = Boolean(process.env.SMOKE_BASE);

const log = (m) => console.log(`[smoke] ${m}`);
const fail = (m) => { console.error(`[smoke] FAIL: ${m}`); return new Error(m); };
let child = null;

function startServer() {
  const c = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  c.stdout.on("data", (d) => { if (process.env.SMOKE_VERBOSE) process.stdout.write(d); });
  c.stderr.on("data", (d) => { if (process.env.SMOKE_VERBOSE) process.stderr.write(d); });
  return c;
}
function stopServer() {
  if (!child) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  child = null;
}
async function waitReady(timeoutMs = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/timeline`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw fail(`サーバーが ${timeoutMs / 1000}s 以内に起動しませんでした (${BASE})`);
}
async function api(method, p, body) {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  if (!externalServer) {
    log(`next dev をポート ${PORT} で起動`);
    child = startServer();
  }
  await waitReady();
  log(`サーバー応答OK: ${BASE}`);

  // ① 種投入
  const seed = JSON.parse(await readFile(SEED, "utf8"));
  const s = await api("POST", "/api/seed", { posts: seed, reset: true });
  if (s.status !== 200 || s.data.count !== seed.length) throw fail(`seed: status=${s.status} ${JSON.stringify(s.data)}`);
  log(`① 種投入 OK: ${s.data.count}件`);

  const tl0 = await api("GET", "/api/timeline?author=keitaro");
  const pastPosts = tl0.data.posts.filter((p) => p.kind === "past" && !p.replyTo && !p.locked);
  if (pastPosts.length === 0) throw fail("keitaro の過去投稿が無い");
  const target = pastPosts[Math.floor(pastPosts.length / 2)];

  // ② 過去投稿へ返信 → AI返答
  const r = await api("POST", "/api/reply", { postId: target.id, text: "それ、今どうなった？", author: "keitaro", authorName: "けいたろう" });
  if (r.status !== 200) throw fail(`reply: status=${r.status} ${JSON.stringify(r.data)}`);
  const ai = r.data.aiReply;
  if (!ai || ai.aiGenerated !== true) throw fail(`reply: aiGenerated が true でない ${JSON.stringify(ai)}`);
  if (ai.at !== target.at) throw fail(`reply: at が元投稿と一致しない ${ai.at} != ${target.at}`);
  if (ai.replyTo !== target.id || !ai.text) throw fail(`reply: replyTo/text が不正`);
  const mode = r.data.mode;
  log(`② 過去返信 OK: 対象=${target.id} (${target.at.slice(0, 10)}) 文脈=${r.data.contextCount}件 mode=${mode}`);
  log(`   AI返答: ${ai.text.slice(0, 80).replace(/\n/g, " ")}…`);

  // ③ 未来宛て投稿 → 未来領域に載る
  const futureAt = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString();
  const f = await api("POST", "/api/post", { author: "keitaro", authorName: "けいたろう", text: "10年後の自分へ。今日、時を超えるSNSを作った。まだ続けてる？", at: futureAt });
  if (f.status !== 200) throw fail(`post: status=${f.status} ${JSON.stringify(f.data)}`);
  if (f.data.post.kind !== "future") throw fail(`post: kind が future でない (${f.data.post.kind})`);
  if (!f.data.aiReply || f.data.aiReply.aiGenerated !== true || f.data.aiReply.at !== f.data.post.at) throw fail(`post: 未来の返答が不正 ${JSON.stringify(f.data.aiReply)}`);
  const now = new Date().toISOString();
  const tl = await api("GET", `/api/timeline?from=${encodeURIComponent(now)}`);
  const ids = tl.data.posts.map((p) => p.id);
  if (!ids.includes(f.data.post.id)) throw fail("post: 未来領域のタイムラインに載っていない");
  if (!ids.includes(f.data.aiReply.id)) throw fail("post: 未来の返答がタイムラインに載っていない");
  if (f.data.mode !== mode) throw fail(`AIモードが一致しない (${f.data.mode} vs ${mode})`);
  log(`③ 未来投稿 OK: ${f.data.post.id} at=${f.data.post.at.slice(0, 10)} 未来領域=${tl.data.count}件 mode=${f.data.mode}`);
  log(`   未来の返答: ${f.data.aiReply.text.slice(0, 80).replace(/\n/g, " ")}…`);

  // ④ 非公開: 他人・匿名は本文を取得できず、本人だけ閲覧できる
  const secret = await api("POST", "/api/post", { author: "keitaro", text: "非公開検証用メモ", visibility: "private" });
  if (secret.status !== 200) throw fail("private 投稿の保存失敗");
  const find = async (id, viewer) => {
    const result = await api("GET", `/api/timeline?viewer=${encodeURIComponent(viewer)}`);
    if (result.status !== 200) throw fail("timeline の取得失敗");
    return result.data.posts.find((p) => p.id === id);
  };
  for (const viewer of ["shunta", ""]) {
    const hidden = await find(secret.data.post.id, viewer);
    if (hidden?.text) throw fail("private 本文が他 viewer に漏れた");
  }
  if ((await find(secret.data.post.id, "keitaro"))?.text !== "非公開検証用メモ") throw fail("本人が private 本文を読めない");
  const denied = await api("POST", "/api/reply", { postId: secret.data.post.id, author: "shunta", text: "読める？" });
  if (denied.status !== 403) throw fail("非公開投稿への他人の返信を拒否していない");
  log("④ private OK: 他 viewer・匿名には本文なし／本人は閲覧可／返信迂回を拒否");

  // ⑤ 時限公開: 本人以外には存在のみ。AI返信も解禁日時を継承
  const capsule = await api("POST", "/api/post", { author: "keitaro", text: "時限公開検証メモ", at: futureAt, unlockAt: futureAt });
  if (capsule.status !== 200 || !capsule.data.aiReply) throw fail("時限公開投稿の保存失敗");
  for (const saved of [capsule.data.post, capsule.data.aiReply]) {
    const other = await find(saved.id, "shunta");
    const owner = await find(saved.id, "keitaro");
    if (!other || other.locked !== true || other.text !== "" || other.unlockAt !== futureAt) throw fail("時限公開の伏字が不正");
    if (owner?.locked || owner?.text !== saved.text) throw fail("時限公開の本人表示が不正");
  }
  log("⑤ unlockAt OK: 他 viewer は locked＋本文空／本人は本文あり／AI返信にも継承");

  const friends = await api("POST", "/api/post", { author: "keitaro", text: "友人向けメモ", visibility: "friends" });
  if (friends.status !== 200 || (await find(friends.data.post.id, ""))?.text || (await find(friends.data.post.id, "shunta"))?.text !== "友人向けメモ") throw fail("friends の閲覧条件が不正");
  const unlocked = await api("POST", "/api/post", { author: "keitaro", text: "解禁済みメモ", unlockAt: "2020-01-01T00:00:00Z" });
  if (unlocked.status !== 200 || (await find(unlocked.data.post.id, ""))?.text !== "解禁済みメモ") throw fail("解禁後も本文が読めない");
  for (const invalid of [{ visibility: "unknown" }, { unlockAt: "invalid" }]) {
    if ((await api("POST", "/api/post", { author: "keitaro", text: "入力検証", ...invalid })).status !== 400) throw fail("不正な公開設定が保存された");
  }
  log("公開範囲の補足検証 OK: friends・解禁済み・不正入力");

  const theme = await api("GET", "/api/theme?date=2026-09-13");
  const again = await api("GET", "/api/theme?date=2026-09-13");
  if (theme.status !== 200 || !theme.data.theme || JSON.stringify(theme.data) !== JSON.stringify(again.data)) throw fail("日替わりテーマが決定的でない");
  if ((await api("GET", "/api/theme?date=2026-02-30")).status !== 400) throw fail("存在しない日付を受理した");
  const today = await api("GET", "/api/theme");
  const jstDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (today.status !== 200 || today.data.date !== jstDate) throw fail("今日のテーマがJSTでない");
  log("⑥ 日替わりテーマ OK: 同一日付で同一テーマ／JST／不正日付を拒否");

  const auth = await api("GET", "/api/auth");
  if (auth.status !== 200 || auth.data.id !== "guest" || auth.data.name !== "ゲスト" || auth.data.enabled !== false) throw fail("smoke はWorkOS未設定のゲストモードで実行してください");
  const guest = await api("POST", "/api/post", { text: "ゲストの投稿" });
  if (guest.status !== 200 || guest.data.post.author !== "guest" || guest.data.post.authorName !== "ゲスト") throw fail("ゲスト投稿が不正");
  log("⑦ 認証未設定 OK: ゲスト取得・ゲスト投稿");

  // ⑧ 時間境界の反例: 直後・遠い未来・非公開・AI・別人は文脈にしない。
  const fixture = (id, at, extra = {}) => ({ id, at, author: "temporal-test", authorName: "検証用デモ", text: id, kind: "past", aiGenerated: false, createdAt: at, visibility: "public", ...extra });
  const temporalSeed = [
    fixture("time-target", "2020-06-01T00:00:00Z"),
    fixture("safe-earlier", "2020-05-01T00:00:00Z"),
    fixture("forbidden-future", "2020-06-01T00:00:01Z"),
    fixture("forbidden-private", "2020-05-02T00:00:00Z", { visibility: "private" }),
    fixture("forbidden-locked", "2020-05-03T00:00:00Z", { unlockAt: "2099-01-01T00:00:00Z" }),
    fixture("forbidden-ai", "2020-05-04T00:00:00Z", { aiGenerated: true }),
    fixture("forbidden-other", "2020-05-05T00:00:00Z", { author: "other-test" }),
    fixture("sparse-target", "2018-06-01T00:00:00Z", { author: "sparse-test" }),
    fixture("safe-distant", "2017-01-01T00:00:00Z", { author: "sparse-test" }),
    fixture("forbidden-sparse-future", "2018-06-02T00:00:00Z", { author: "sparse-test" }),
    fixture("first-target", "2016-01-01T00:00:00Z", { author: "first-test" }),
    fixture("forbidden-first-future", "2016-01-02T00:00:00Z", { author: "first-test" }),
  ];
  if ((await api("POST", "/api/seed", { posts: temporalSeed })).status !== 200) throw fail("時間境界の検証データ投入失敗");
  for (const [postId, author, count, hint] of [
    ["time-target", "temporal-test", 2, "safe-earlier"],
    ["sparse-target", "sparse-test", 2, "safe-distant"],
    ["first-target", "first-test", 1, "first-target"],
  ]) {
    const result = await api("POST", "/api/reply", { postId, author, text: "当時何を考えていた？" });
    if (result.status !== 200 || result.data.contextCount !== count) throw fail(`時間境界/公開制御: ${postId} context=${result.data.contextCount}`);
    if (result.data.mode === "mock" && (!result.data.aiReply.text.includes(hint) || result.data.aiReply.text.includes("forbidden"))) throw fail("モックに未来/非公開文脈が混入");
  }
  const futureContext = await api("POST", "/api/post", { author: "first-test", text: "未来の自分へ", at: "2090-01-01T00:00:00Z" });
  const futureContextAgain = await api("POST", "/api/post", { author: "first-test", text: "もう一度未来へ", at: "2091-01-01T00:00:00Z" });
  if (futureContext.status !== 200 || futureContextAgain.status !== 200 || futureContext.data.historyCount !== 2 || futureContextAgain.data.historyCount !== 2) throw fail("未来宛て投稿を過去の実績として文脈に混入");
  log("⑧ AI文脈 OK: 時間境界・疎な履歴・初回投稿・非公開・他人・AI・未来宛ての除外");

  for (const endpoint of ["/api/post", "/api/reply"]) {
    for (const invalid of [[], { text: 123, postId: "time-target" }, { text: "x".repeat(2001), postId: "time-target" }, { text: "valid", postId: "time-target", author: {} }]) {
      if ((await api("POST", endpoint, invalid)).status !== 400) throw fail(`invalid input accepted: ${endpoint}`);
    }
  }
  log("⑨ invalid input rejected: arrays, wrong types, overlong text (400)");

  if ((await api("POST", "/api/seed", { posts: seed, reset: true })).status !== 200) throw fail("reset failed");
  const removedAuthor = await api("GET", "/api/timeline?author=first-test");
  if (removedAuthor.status !== 200 || removedAuthor.data.posts.length !== 0) throw fail("reset retained stale author history");
  const staleReply = await api("POST", "/api/reply", { postId: "first-target", author: "first-test", text: "reset後の参照" });
  if (staleReply.status !== 404) throw fail("reset retained addressable stale post");
  log("⑩ reset excludes stale author history and rejects stale post replies (404)");

  log(`PASS — AI mode: ${mode === "live" ? "live (Claude API)" : "mock (ANTHROPIC_API_KEY 未設定 or MOCK_AI=1)"}`);
}

main()
  .then(() => { stopServer(); process.exit(0); })
  .catch((e) => { console.error(e?.message ?? e); stopServer(); process.exit(1); });
process.on("SIGINT", () => { stopServer(); process.exit(130); });
