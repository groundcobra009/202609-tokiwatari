# CHANGELOG — 時渡り（Tokiwatari）ハッカソンMVP

確定した変更の履歴。ブランチで共有する変更は未マージと明記する。
議論・試行錯誤の経緯はIssueに書く（記録の使い分けは ai-company の CLAUDE.md §4.6）。

記録項目: 日付／バージョンまたはIssue番号／変更対象／変更内容／変更理由／影響範囲

共同開発の共有状況: Issue #3、`codex/issue-3-timetalk`（未マージ）。実装は `6ce52fa` で共有。以下の「未コミット」は各作業時点の記録であり、この共有後の状態を示さない。検証は `npm run check` exit 0（mock / guest、smoke 10群）。

---

## 2026-09-13 — Issue #3：時間ごとの返答比較と今日の一歩（未マージ）

- **変更対象**: Timeline、CSS、投稿/返信API、Post型、AIプロンプト、smoke、README、DECISIONS、引き継ぎ・発表台本。
- **変更内容**: サンプルの選択→同じ問いを過去/未来へ→返答比較→今日の行動を本人の言葉で記録。生成時に渡した投稿一覧を保存し、本文の確認・元投稿への移動を追加。
- **理由**: 最新ユーザー指示により15:00まで延長し、公式5観点で残る価値・新規性・AIの工夫を作品上で示す。
- **検証**: check exit 0（mock/guest、10群）、参照IDの時間/公開境界・永続化・履歴0件。ローカルWorkersで往復→今日の投稿、390px幅の比較表示、console errorなしを確認。
- **公開**: 最終Cloudflareコードバージョン `fadfb21b-a4e1-4455-9120-066aa5574903`。実AIの比較4応答・今日の投稿保存を確認。通常投稿の待機文言も修正。公式5観点に沿う自己評価25/25（独立した審査ではない）、根拠は自己評価の最新記録。

## 2026-09-13 — 公開データの保全（未コミット）

- **変更対象**: seed API、store、smoke、README、DECISIONS、自己評価。
- **変更内容**: 公開URLのseedを403で拒否。reset後の旧投稿参照を404へ統一。ローカルseedの不正型入力を400で拒否。
- **検証**: check exit 0（mock/guest）、既存10群のsmoke成功。

## 2026-09-13 — 投稿・会話中心のUI（未コミット）

- **変更対象**: Timeline、globals.css、lib/store.ts、smoke、デモ台本、DECISIONS、自己評価。
- **変更内容**: 投稿欄を先頭へ、過去/未来/全件切替、フィード型カード、年ナビ整理、テーマ/取り込みの折りたたみ。reset後の古い作者別履歴の混入を防止。
- **検証**: check exit 0（mock/guest）、390px幅と会話・テーマ・切替操作を確認。

## 2026-09-13 — 文字主体ロゴ・Cloudflare公開（未コミット）

- **変更対象**: public/timetalk-mark.svg・timetalk-wordmark.svg、Timeline、layout、README、DECISIONS、自己評価。旧画像は_archiveへ保管。
- **変更内容**: 合意した文字主体のロゴへ変更。Claudeキーの設定方法を記録。最新ユーザー指示により既存Cloudflare Workerへデプロイし、35件の手書きデータを追加。
- **検証**: check exit 0（mock/guest）。公開ページ・各GET API・ロゴHTTP 200、鍵付き本文の伏せ字を確認。
- **公開バージョン**: 79a2dfbc-3281-46e0-80f0-da2d0dcedf64。

## 2026-09-13 — 評価改善・タイムトークへ改名（実装済み・未コミット）

- **変更対象**: app/api/post・reply、lib/ai.ts、scripts/smoke.mjs、Timeline、globals.css、layout、public/timetalk-logo.png、README、docs/pitch.md・demo-script.md・self-eval.md、DECISIONS。
- **変更内容**: 過去AIの時間境界と未来宛て履歴の除外、本文上限・型検証、AIタイムアウト、反例テスト。質問例と体験導線。5分発表原稿と初期導入計画。サービス名・ロゴをタイムトークへ統一。
- **理由**: 25点を目指すユーザーの改善指示と改名指示。
- **検証**: npm run check exit 0（mock/guest）。Workers上で過去・未来の会話とスマートフォン幅を確認。内部評価17/25。実AIと第三者の証拠は未収集。

## 2026-09-13 — Apple風UI（実装済み・未コミット）

- **変更対象**: components/Timeline.tsx、app/globals.css、DECISIONS.md、docs/self-eval.md。
- **変更内容**: 白基調の画面、透過ヘッダー、体験開始の入口、デモ説明、ユーザー切替の説明、日本語システムフォント、スマートフォン対応。
- **変更理由**: ユーザー指定のAppleデザインを反映し、初見の体験導線を改善。
- **検証**: npm run check exit 0（mock/guest）。PC・スマートフォン幅と主要導線をローカルWorkersで確認。

## 2026-09-13 — 公式PDFルーブリック整備（未コミット）

- **変更対象**: RUBRIC.md、docs/self-eval.md。
- **変更内容**: 公式5観点・各1〜5点・同点ルールをPDF p.4と照合し、内部の段階別採点基準と評価手順を追加。提出・発表条件を出典ページ付きで記録。初回自己評価16/25、check exit 0（mock/guest）。
- **変更理由**: ユーザーのPDFに基づく評価・改善依頼。13:30までにアプリを仕上げる最新目標を記録。
- **影響範囲**: 文書のみ。公式基準と独自の内部目安を明確に分離。

## 2026-09-13 — #3 v0.2（実装済み・未コミット／未マージ）

- **変更対象**: 公開範囲の型・保存・API、テーマと認証のAPI、Timelineと追加コンポーネント、種データ、smoke、依存関係、環境変数の設定例、DECISIONS・README。
- **変更内容**: visibility/unlockAtとviewer別の本文伏せ字、公開範囲・公開年数セレクト、各人1件の鍵付き種（計35件）、日本語30件の日替わりテーマ（JST・日付ハッシュ）、テーマ文のフォーム差し込み、取り込み入口の準備中モーダル。WorkOS AuthKitのログイン・callback・ログアウトとキーなしゲストモードを追加。
- **変更理由**: Issue #3の必須体験を既存の3体験を壊さず実装し、RUBRICの「動くか」を満たすため。
- **影響範囲**: 旧投稿はpublicとして扱う。AI返答は制限を継承し、非公開・未解禁の別投稿を文脈に混ぜない。認証未設定のviewerはデモ用自己申告。実キー利用時はログインIDをサーバーで確定する。取り込みのAPI・ファイル解析は未実装（DEC-006）。
- **検証**: `npm run check` exit 0（AI mock / 認証guest）。private・unlockAtの必須2ケース、friends・解禁後・不正入力・テーマ・ゲストを含むsmoke成功。ビルド済みローカルWorkersでも成功。画面で公開設定・鍵付きカード・テーマ差し込み・モーダル開閉を確認。WorkOSはダミー設定でログイン開始まで確認、実Google認証とClaude実応答は未検証。
- **引き継ぎ**: ユーザー指定によりマージ前の実装記録として追記。コミット・push・本番デプロイ・キー登録は未実施。

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

### 公開後の修正（同日・未コミット）

- app/page.tsxとTimelineで初回日時を共有し、公開版で検出したReact #418を解消。check exit 0（mock/guest）後に再公開。
- 最終version: 06dcb401-745a-41ef-88c2-fbfa5b694d69。公開画面の再読込・データ表示後、新規エラーログ0件を確認。

### Claude実応答の再評価（同日・文書のみ）

- docs/live-eval.jsonとdocs/self-eval.mdへ公開版の実AI3ケースの入出力と評価を記録。すべてHTTP 200 / live。
- 内部評価18/25（AI3→4）。第三者評価・厳密な比較実験等の未確認条件は残す。

### 当日審査への評価基準是正（同日・文書のみ）

- RUBRIC.mdを公式5観点に沿った当日の作品・デモ評価へ是正。独自の長期検証を満点の必須条件にしない。旧版は_archiveへ保存。
- 自己評価は別尺度で22/25。旧18点との比較は不可と明記。実AIの根拠を使う発表説明を補強。
