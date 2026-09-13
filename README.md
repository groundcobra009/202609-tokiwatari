# 時渡り（Tokiwatari）— 思考が時を超えるSNS

- 案件ID: 202609-tokiwatari
- 開始日: 2026-09-13（AI木曜会 × AGIラボ 合同AIハッカソン・チーム16）
- 指揮・記録: ai-company（ポインタ: company/projects/202609-tokiwatari.md）

**この案件の北極星は [GOAL.md](GOAL.md)。** Issueを切る前・設計を提案する前に必ず読む。
評価の基準は [RUBRIC.md](RUBRIC.md)（公式5観点・同点時は「動くか」が最優先）。引き継ぎは [docs/HANDOVER.md](docs/HANDOVER.md)、Codex への依頼は [docs/codex-handoff.md](docs/codex-handoff.md)。
企画書は [docs/proposal.md](docs/proposal.md)、ピッチは [docs/pitch.md](docs/pitch.md)、デモ台本は [docs/demo-script.md](docs/demo-script.md)。

## ローカルで動かす

```bash
npm install
cp .dev.vars.example .dev.vars   # ANTHROPIC_API_KEY を書く（無ければモック応答）
npm run dev                      # http://localhost:3000
npm run seed -- --reset          # 別ターミナルで種データ（seed/*.json）を投入
```

- `.dev.vars` は gitignore 済み。`ANTHROPIC_API_KEY` が無い、または `MOCK_AI=1` のときは決定的なモック返答になる
- ローカルの KV は `.wrangler/state/`（miniflare）に保存される

## ゴールコマンド

```bash
npm run check   # typecheck → OpenNext ビルド → scripts/smoke.mjs（種投入・過去返信・未来投稿をHTTPで検証）
```

## API

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/seed` | `{posts: Post[], reset?: boolean}` を KV に投入 |
| GET | `/api/timeline?from&to&author` | 時間座標順の投稿一覧 |
| POST | `/api/reply` | `{postId, text, author?, authorName?}` 過去投稿へ返信 → 当時の本人（AI再現）の返答を保存 |
| POST | `/api/post` | `{author, authorName?, text, at?}` 投稿。`at` が未来なら未来の自分（AI推定）の返答を保存 |

投稿の形: `{id, author, authorName, text, at, kind: past|now|future, replyTo?, aiGenerated, createdAt}`

## 本番（Cloudflare Workers）

公開URL: `https://tokiwatari.keitro-aigc.com`（`wrangler.jsonc` の custom_domain・workers.dev 不使用）

```bash
npx wrangler secret put ANTHROPIC_API_KEY   # 初回のみ
npm run deploy                              # opennextjs-cloudflare build && deploy
npm run seed -- --reset --base https://tokiwatari.keitro-aigc.com
```

デプロイ・シークレット登録は承認キュー経由で社長が実行する（AIは実行しない）。
