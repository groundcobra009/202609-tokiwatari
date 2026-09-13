# 引き継ぎ書 — 時渡り（Tokiwatari）

この文書は、**チームメンバー・Codex・Claude Code が今この瞬間から作業を引き継ぐための1枚**。
読む順番: 本書 → `GOAL.md` → `RUBRIC.md`（公式審査基準）→ `DECISIONS.md` → `docs/proposal.md` → `docs/codex-handoff.md`（次の実装タスク）。

最終更新: 2026-09-13 12:10 JST（ハッカソン当日・発表 20:00）

## 1. 何を作っているか

「思考が時を超えるSNS」。投稿が時間座標を持ち、過去の自分・未来の自分・後世の誰かと対話できる。
企画の全体像は `docs/proposal.md`（v0.2）。北極星は `GOAL.md` §3（完成状態）。

## 2. 今どこまでできているか

| 項目 | 状態 |
|---|---|
| タイムライン（今の線・年ジャンプ・過去⇄未来） | 完了（Issue #1・PR #2） |
| 過去投稿への返信 → 当時の本人（AI再現） | 完了 |
| 未来宛て投稿 → 未来の自分（AI推定） | 完了 |
| 種データ（手書き32件・3人分） | 完了（`seed/sample.json`） |
| ピッチ・デモ台本 | 完了（`docs/pitch.md`・`docs/demo-script.md`） |
| ゴールコマンド `npm run check` | 通過（AIはモックで検証） |
| 時間つき公開範囲・日替わりテーマ・Google ログイン | **未着手（v0.2・`docs/codex-handoff.md`）** |
| 本番デプロイ・`ANTHROPIC_API_KEY` 登録 | 承認待ち（coo-20260913-02・けいたろうが実行） |
| 実キーでの返答品質 | 未確認 |
| 「過去の発信を取り込む」入口のUI（実装はしない・DEC-006） | 未着手（v0.2） |

## 3. 動かし方

```bash
npm install
cp .dev.vars.example .dev.vars   # ANTHROPIC_API_KEY を書く（無ければモック返答）
npm run dev                      # http://localhost:3000
npm run seed -- --reset          # 別ターミナルで種を投入
npm run check                    # ゴールコマンド（typecheck → OpenNext build → smoke）
```

## 4. 構成（どこに何があるか）

```
app/page.tsx              画面（タイムライン本体は components/Timeline.tsx）
app/api/timeline/route.ts GET  時間座標順の投稿一覧（?from&to&author）
app/api/post/route.ts     POST 投稿（at が未来なら未来の自分の返答を付ける）
app/api/reply/route.ts    POST 過去投稿への返信（当時の本人の返答を付ける）
app/api/seed/route.ts     POST 種投入（{posts, reset}）
lib/types.ts              Post 型・kindOf・newId
lib/ai.ts                 Claude API 呼び出しとプロンプト（過去再現／未来推定）・モック切替
lib/store.ts              KV アクセス（post:<id>・index:all・index:<author>）・メモリフォールバック
scripts/seed.mjs          seed/*.json → /api/seed
scripts/smoke.mjs         ゴールコマンドの検証（種投入・過去返信・未来投稿）
seed/sample.json          手書き種（keitaro 20・shunta 6・yakan 6）
wrangler.jsonc            Workers 設定（KV POSTS・custom_domain tokiwatari.keitro-aigc.com）
docs/                     企画書・ピッチ・デモ台本・本書・Codex引き継ぎ
```

投稿の形: `{id, author, authorName, text, at, kind, replyTo?, aiGenerated, createdAt}`（v0.2 で `visibility`・`unlockAt` を追加予定）

## 5. 確定している判断（詳細は DECISIONS.md）

- DEC-001 スタックは Next.js＋OpenNext＋Cloudflare Workers＋KV＋Claude API
- DEC-002 過去の思考の種は本人の既存発信の取り込み（当日は手書き種で代替）
- DEC-003 キー未設定時は決定的モック。応答に `mode` を含める
- DEC-004 KV は `post:<id>`＋`index:*`。Workers 外はメモリ
- DEC-005 時間越しの返信は元投稿と同じ時間座標に置く
- DEC-006 種はAPI取り込みせず手書き。「取り込み」は入口のUIだけ

## 6. 作業の進め方（ルール）

- **Issue 駆動**: 要件は GitHub Issue、実行 TODO は Beads（`bd ready` / `bd update <id> --claim` / `bd close <id>`）。Issue #1 は Epic `tw-uxs`（完了）、v0.2 は Issue #3
- **Codex で実装するとき**: `docs/codex-handoff.md` を渡す。Codex はコミット・`gh`・デプロイをしない（Claude 側が行う）。手順は同書の末尾
- **削除禁止**: `rm` を使わない。不要物は `_archive/` へ
- **シークレット**: `.dev.vars`（gitignore 済み）と `wrangler secret`。チャット・リポに貼らない
- **外に出る操作**（デプロイ・共有・課金）は ai-company の承認キュー経由でけいたろうが実行
- 公開名義は「けいたろう」

## 7. 承認待ち・依頼中

| ID | 内容 | 実行者 |
|---|---|---|
| coo-20260913-01 | 企画書 Doc をチーム2名へ共有 | けいたろう |
| coo-20260913-02 | `wrangler secret put ANTHROPIC_API_KEY` → `npm run deploy` → seed | けいたろう |
| （未登録） | リポへのコラボレーター招待（GitHub ユーザー名待ち） | けいたろう |

## 8. 次にやること（優先順）

1. 体験4「時間つき公開範囲」（`visibility` / `unlockAt`・鍵付きは存在だけ見える）
2. 日替わりテーマの表示（`/api/theme`・画面カード）
3. Google ログイン（WorkOS AuthKit・環境変数が無ければゲストモードで動く）
4. 本番デプロイ（承認後）と実キーでの返答確認
5. 「取り込み」入口のUI（準備中表示のみ）
6. 動画・プレゼン（人間の審査向け）

## 8b. 評価の基準

公式5観点（価値・実現性・新規性・AIの活かし方・展開性・各1〜5点）。同点は「動くか」→「誰の役に立つか」。`RUBRIC.md` 参照。**動いていることが最優先**。

## 9. リンク

- リポ: https://github.com/groundcobra009/202609-tokiwatari
- Issue #1: https://github.com/groundcobra009/202609-tokiwatari/issues/1 ／ PR #2: https://github.com/groundcobra009/202609-tokiwatari/pull/2
- 企画書 Doc（v0.1・メンバー意見つき）: https://docs.google.com/document/d/1NTksIEAPMl9IuwjBxoZNMjOdnhki1-OrsLgcomayi0M/edit
- 公開URL（デプロイ後）: https://tokiwatari.keitro-aigc.com
- 指揮・記録: ai-company `company/projects/202609-tokiwatari.md`・カンバン T159
