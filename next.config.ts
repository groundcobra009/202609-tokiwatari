import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// `next dev` でも wrangler.jsonc の KV binding（ローカル miniflare・.wrangler/state）を使えるようにする
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // next dev が AGENTS.md を書き換えるのを止める（AGENTS.md は運用ルールの正本）
  agentRules: false,
  turbopack: { root: __dirname },
};

export default nextConfig;
