# CHANGELOG — 時渡り（Tokiwatari）ハッカソンMVP

確定した変更の履歴。**マージされた変更だけ**を新しい順に記録する。
議論・試行錯誤の経緯はIssueに書く（記録の使い分けは ai-company の CLAUDE.md §4.6）。

記録項目: 日付／バージョンまたはIssue番号／変更対象／変更内容／変更理由／影響範囲

---

## 2026-09-13 — #1 ハッカソンMVP（双方向タイムラインと時間越し返信）

- **変更対象**: アプリ一式（`app/`・`components/`・`lib/`）、`wrangler.jsonc`・`open-next.config.ts`・`next.config.ts`、`scripts/seed.mjs`・`scripts/smoke.mjs`、`seed/sample.json`、`docs/pitch.md`・`docs/demo-script.md`、`README.md`
- **変更内容**: Next.js 16＋OpenNext＋Cloudflare Workers（KV `POSTS`・custom_domain `tokiwatari.keitro-aigc.com`）で、時間座標つきタイムライン（今の線・年ジャンプ）、過去投稿への返信→当時の本人（AI再現）、未来宛て投稿→未来の自分（AI推定）を実装。Claude API（`claude-sonnet-5`）はキー未設定/`MOCK_AI=1` で決定的モックに切替。`npm run check`（typecheck→OpenNextビルド→smoke）をゴールコマンドとして整備。手書き種32件とピッチ・デモ台本を追加
- **変更理由**: GOAL §3 の完成状態 2〜4・6（タイムライン／過去の返信／未来の返信／ピッチ）を当日中に満たすため
- **影響範囲**: 新規（既存機能なし）。本番デプロイと `ANTHROPIC_API_KEY` の secret 登録は未実施（承認キュー経由・社長）

## 2026-09-13 — 案件開始

- **変更対象**: リポジトリ全体
- **変更内容**: 案件ディレクトリを新設（clone-firstフロー）
- **変更理由**: 時渡り（Tokiwatari）ハッカソンMVP の作業開始
- **影響範囲**: なし（初期化）
