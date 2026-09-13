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
  const pastPosts = tl0.data.posts.filter((p) => p.kind === "past" && !p.replyTo);
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

  log(`PASS — AI mode: ${mode === "live" ? "live (Claude API)" : "mock (ANTHROPIC_API_KEY 未設定 or MOCK_AI=1)"}`);
}

main()
  .then(() => { stopServer(); process.exit(0); })
  .catch((e) => { console.error(e?.message ?? e); stopServer(); process.exit(1); });
process.on("SIGINT", () => { stopServer(); process.exit(130); });
