# タイムトーク（Time Talk）— 思考が時を超えるSNS

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
| POST | `/api/seed` | ローカル専用。`{posts: Post[], reset?: boolean}` をKVに投入。公開環境は403 |
| GET | `/api/timeline?from&to&author&viewer` | 時間座標順の投稿一覧。閲覧不可の本文は空文字＋locked。認証設定済みならviewerはセッションから確定 |
| POST | `/api/reply` | `{postId, text, author?, authorName?, visibility?, unlockAt?}` 過去投稿へ返信 → 当時の本人（AI再現）の返答を保存 |
| POST | `/api/post` | `{author?, authorName?, text, at?, visibility?, unlockAt?}` 投稿。`at` が未来なら未来の自分（AI推定）の返答を保存 |
| GET | `/api/theme?date=YYYY-MM-DD` | `{date, theme, index}`。日付省略はJSTの今日。不正日付は400 |
| GET | `/api/auth` | `{id, name, enabled, authenticated}`。キー不足時はguest。メール・トークンは返さない |
| GET | `/auth/login` | WorkOS AuthKitへ遷移。未設定時はトップへ戻る |
| GET | `/auth/callback` | AuthKitの認可コード・stateを検証しセッションCookieを保存 |
| POST | `/auth/logout` | 同一オリジンからのリクエストでログアウト |

`visibility`: public（既定）/ friends / private。`unlockAt` はISO日時。時限解禁後もvisibilityの条件は維持される。`locked` は応答専用で保存しない。返信とAI返答は元投稿より公開範囲を広げない。

認証キー未設定ではviewer/authorを自己申告するデモ用ゲストモード。設定済みではセッションIDを採用し、匿名viewerは空。ログイン時の公開名義は「けいたろう」（氏名・メールは公開しない）。Googleプロバイダーとcallback/logout URLのWorkOS側設定、実ログイン確認は本人が行う。認証APIの構成は[AuthKit公式SDK](https://github.com/workos/authkit-nextjs)を参照。

本文は2000文字以内。過去AIの文脈は対象日時以前の最大10件、未来AIの文脈は現在までの公開履歴。別の非公開・未解禁投稿、AI生成文、未来宛ての投稿を既知の事実として渡さない。AI呼び出しは20秒でタイムアウトし、自動再試行しない。

投稿の形: `{id, author, authorName, text, at, kind: past|now|future, replyTo?, aiGenerated, createdAt, visibility, unlockAt?, locked?}`

## 本番（Cloudflare Workers）

公開URL: `https://tokiwatari.keitro-aigc.com`（`wrangler.jsonc` の custom_domain・workers.dev 不使用）

```bash
npx wrangler secret put ANTHROPIC_API_KEY   # 初回のみ
npm run deploy                              # opennextjs-cloudflare build && deploy
 # 公開環境のデモ35件は投入済み。公開seed APIは初期化防止のため403
```

デプロイ・シークレット登録は承認キュー経由で社長が実行する（AIは実行しない）。

## Claude APIキーを後から設定する

本番Workerの名前は **tokiwatari**（画面のサービス名はタイムトーク）。

1. Cloudflareダッシュボード → **Workers & Pages** → **tokiwatari** → **Settings** → **Variables and Secrets** を開く。
2. **Add** で型を **Secret**、名前を **ANTHROPIC_API_KEY** にする。値は本人がその画面で入力する。
3. **Deploy** で反映する。`MOCK_AI` が `1` なら、`0` に変更する（未設定ならそのままでよい）。
4. 公開画面から新しく過去返信・未来投稿を行い、**AI: Claude** と返答を確認する。既存のモック返答は自動で作り直されない。

必要に応じて通常の変数 `ANTHROPIC_MODEL` に利用可能なモデルIDを設定する。未指定の既定値は `claude-sonnet-5`。無効なモデル・権限不足・残高不足はAPIエラーになる。
キーがない間はmockで操作できる。キーをチャット・ソースコード・wrangler.jsoncに貼らない。ローカルだけで試す場合は、gitignore対象の`.dev.vars`に同名を本人が設定し、ローカルサーバーを再起動する。本番のSecretとは別管理。

根拠: [Cloudflare Secrets公式](https://developers.cloudflare.com/workers/configuration/secrets/)、[Claudeモデル一覧](https://platform.claude.com/docs/en/models/overview)。


### 返答と元の記録を比べる

ホームで「けいたろうのサンプルで比べる」を選び、同じ問いを「1 · 過去に聞く」「2 · 未来に聞く」の順で送信すると、2つの返答を並べて比較できます。返答の「AIに渡した記録」は、生成時に入力した記録の一覧です。引用の保証ではありません。元の投稿へ戻って確かめられます。

`POST /api/reply` と未来宛ての `POST /api/post` の `aiReply` に `sourcePostIds: string[]` と `aiMode: "mock" | "live"` を保存。タイムラインでも取得できます。鍵付き返答は参照IDも伏せます。旧返答の一覧は未保存です。
