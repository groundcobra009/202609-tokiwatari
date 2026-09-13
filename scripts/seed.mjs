#!/usr/bin/env node
// 種データ（seed/*.json）を POST /api/seed に投入する
//   node scripts/seed.mjs [--reset] [--base http://localhost:3000] [file.json ...]
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const baseIdx = args.indexOf("--base");
const base = (baseIdx >= 0 ? args[baseIdx + 1] : process.env.BASE_URL) || "http://localhost:3000";
const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");

const seedDir = path.resolve(process.cwd(), "seed");
const targets = files.length
  ? files
  : (await readdir(seedDir)).filter((f) => f.endsWith(".json")).map((f) => path.join(seedDir, f));

let posts = [];
for (const f of targets) {
  const arr = JSON.parse(await readFile(f, "utf8"));
  if (!Array.isArray(arr)) throw new Error(`${f}: 配列ではありません`);
  posts = posts.concat(arr);
}
if (posts.length === 0) throw new Error("投入する投稿がありません");

const res = await fetch(`${base}/api/seed`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ posts, reset }),
});
const data = await res.json();
if (!res.ok) {
  console.error("seed 失敗:", data);
  process.exit(1);
}
console.log(`seed 完了: ${data.count}件 (${targets.map((t) => path.basename(t)).join(", ")}) reset=${data.reset} → ${base}`);
