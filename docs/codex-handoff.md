# Codex引き継ぎ書: 時渡り v0.2（時間つき公開範囲・日替わりテーマ・Google ログイン）

- カンバン: [T159]
- 日付: 2026-09-13
- 種別: アプリ実装
- GitHub Issue: #3（Claude 側が起票。Beads Epic は `bd ready` で確認）

## 役割分担（この体制の前提）

- **Claude側（COO/dev-lead）**: プラン作成・本書の執筆・Issue/PR/コミット/push・承認キュー登録・質問への回答
- **Codex側**: 本書に書かれた実装のみ。プランの変更が必要だと判断したら、変更せず停止して最終メッセージで提案する

## 目的

企画書 v0.2（`docs/proposal.md`）で追加された体験4「時間つき公開範囲」と、投稿を促す「日替わりテーマ」、平和なSNSのための「Google ログイン」を、既存MVP（Issue #1）を壊さずに足す。GOAL.md §3 に効く。

## 前提知識（先に読む）

- `docs/HANDOVER.md`（現状・構成・ルール）→ `GOAL.md` → `RUBRIC.md`（公式審査基準: 動くことが最優先）→ `DECISIONS.md`（DEC-001〜006）
- 既存コード: `lib/types.ts`・`lib/store.ts`・`lib/ai.ts`・`app/api/*/route.ts`・`components/Timeline.tsx`・`scripts/smoke.mjs`
- 起動: `npm install && npm run dev`、別ターミナルで `npm run seed -- --reset`

## プラン（実装手順・この順に）

### 1. 時間つき公開範囲（最優先・必須）

1. `lib/types.ts` の `Post` に追加: `visibility: "public" | "friends" | "private"`（既定 `public`）、`unlockAt?: string`（ISO。時限公開。この日時まで本文を伏せる）
2. `POST /api/post`・`POST /api/reply` で `visibility`・`unlockAt` を受け取り保存。未指定は `public`・`unlockAt` なし。過去データ（フィールド無し）は `public` として扱う
3. `GET /api/timeline` に `?viewer=<author>` を追加。返却ルール:
   - `private` は `viewer === author` のときだけ本文を返す
   - `friends` は今日は `viewer` が空でなければ本文を返す（フォローは非スコープ・DEC に理由を書く）
   - `unlockAt` が未来の投稿は、本人以外には **本文を伏せて存在だけ返す**: `text: ""`、`locked: true`、`unlockAt` を含める（`Post` に `locked?: boolean` を追加。保存はしない・応答時のみ付与）
4. 画面: 投稿フォームに公開範囲セレクト（公開／友人／非公開）と「◯年後に公開」の年セレクト（1・3・5・10年後 → `unlockAt` を計算）。鍵付きカードは「🔒 2036年9月に公開」とだけ表示
5. `scripts/smoke.mjs` に2ケース追加: ①`private` 投稿が他 viewer の timeline に本文付きで出ない ②`unlockAt` 未来の投稿が他 viewer には `locked: true`・本文空で出る、本人には本文が出る
6. `seed/sample.json` に鍵付き投稿を各人1件追加（例: けいたろう「2036年に公開」の暗黙知メモ）

### 2. 日替わりテーマ（必須）

1. `lib/themes.ts` に日本語テーマ30件（他のSNSで聞かれないもの: 「10年後の家族へのメッセージ」「今日、自分を一番驚かせたこと」「20年後の自分に聞きたいこと」「今は言えないが10年後なら言えること」等）
2. `GET /api/theme?date=YYYY-MM-DD` → その日のテーマを**決定的に**返す（日付のハッシュで選ぶ・省略時は今日・JST）
3. 画面上部に「今日のテーマ」カードと「このテーマで書く」ボタン（押すと投稿フォームにテーマ文が入る）
4. プッシュ通知は非スコープ（表示のみ）

### 3. Google ログイン（WorkOS AuthKit・環境変数があるときだけ有効）

1. `npm i @workos-inc/authkit-nextjs`。環境変数 `WORKOS_API_KEY`・`WORKOS_CLIENT_ID`・`WORKOS_COOKIE_PASSWORD`・`NEXT_PUBLIC_WORKOS_REDIRECT_URI`（`.dev.vars.example` にキー名だけ追記。値は書かない）
2. `lib/auth.ts`: 環境変数が揃っていれば AuthKit で現在ユーザー（`id`・`firstName`/`email`）を返す。**揃っていなければ `{ id: "guest", name: "ゲスト" }` を返すゲストモード**（smoke・モック検証が通り続けるため）
3. `app/auth/callback/route.ts`（AuthKit のコールバック）、ヘッダーに「Google でログイン／ログアウト」。ログイン中は投稿の `author` にユーザー id・`authorName` に表示名を使う
4. OpenNext / Workers で動くこと（`npm run check` が通ること）。動かない場合はこの手順を止め、最終メッセージで理由と代替案を報告（ゲストモードのまま PR にしてよい）

### 3b. 「過去の発信を取り込む」入口（任意・実装しない）

1. 画面のヘッダーかフォーム近くに「過去の発信を取り込む（X・note・日記）」ボタンを置く。押すとモーダルで「準備中。ハッカソン版では手書きの種を使っています。将来は X のアーカイブや note を取り込めます」と説明を出すだけ。API 呼び出し・ファイル解析は**実装しない**（DEC-006）

### 4. 記録

- `CHANGELOG.md` に新しい順で追記（Issue #3）
- `DECISIONS.md` に追記: DEC-007「時限公開は存在だけ見せる」、DEC-008「friends は今日は viewer あり＝閲覧可（フォロー未実装）」、DEC-009「認証は環境変数があるときだけ有効・ゲストモードで動作」

## 完了条件（ゴールコマンド）

- `cd /Users/keitaro_aigc/002project/202609-tokiwatari && npm run check` が exit 0（smoke に公開範囲2ケースが含まれていること）
- `npm run dev` で: 公開範囲セレクトと「◯年後に公開」が使え、鍵付きカードが伏字で出る／今日のテーマが表示される／WorkOS 未設定でもゲストとして投稿できる

## 入力（参照素材）

- `/Users/keitaro_aigc/002project/202609-tokiwatari/docs/proposal.md`（v0.2・体験4／5／6 節）
- `/Users/keitaro_aigc/002project/202609-tokiwatari/docs/HANDOVER.md`
- `/Users/keitaro_aigc/002project/202609-tokiwatari/GOAL.md`・`DECISIONS.md`
- 既存実装一式（上記「前提知識」）

## 出力先

- `/Users/keitaro_aigc/002project/202609-tokiwatari/` 配下のみ

## 対象ファイル

- 変更可: `lib/types.ts`・`lib/store.ts`・`lib/ai.ts`（返答保存時の visibility 継承のみ）・`app/api/**`・`app/page.tsx`・`app/globals.css`・`components/**`・`scripts/smoke.mjs`・`seed/sample.json`・`package.json`/`package-lock.json`・`.dev.vars.example`・`CHANGELOG.md`・`DECISIONS.md`・`README.md`（API表の追記）
- 新規可: `lib/themes.ts`・`lib/auth.ts`・`app/api/theme/route.ts`・`app/auth/**`・`components/*`
- **変更しない**: `wrangler.jsonc`（KV id・ドメイン）・`GOAL.md`・`RUBRIC.md`・`docs/proposal.md`・`docs/pitch.md`・`docs/demo-script.md`・`.beads/`・`_archive/`

## 制約

- 共通（詳細はAGENTS.md）: 下書きの作成・保存まで。公開・送信・課金・本番デプロイ・`gh`・`rm` は行わない。シークレットを表示しない。不明点は推測せず停止して報告
- タスク固有:
  - 既存の3体験（タイムライン・過去返信・未来返信）と既存 smoke ケースを壊さない
  - `ANTHROPIC_API_KEY`・WorkOS キーが無くても `npm run check` が通ること（モック／ゲストモード）
  - AI 生成の返答には引き続き `aiGenerated: true` と画面ラベル
  - 公開画面に本名を出さない（名義「けいたろう」）
  - Google Fonts を使わない（システムフォント）
  - 時間切れ優先順位: 手順1 → 2 → 3b → 3。**16:30 までに動いているところで止めて報告**。RUBRIC の同点ルール（動くか最優先）のため、既存機能を壊す変更は入れない

## 種別ごとの注意

- **アプリ実装**: コミットはしない（変更はワーキングツリーに残す。コミット・PR操作はClaude側）。ゴールコマンドを通してから完了報告

## 質問への回答（追記式・新しいものを下に）

- （初回読み込みの質問をここに追記）

---

## 運用フロー（この引き継ぎ書の使い方）

1. Claude側がプランを固めて本書を作成し、対象リポジトリの `docs/codex-handoff.md` に置く（済み）
2. **初回読み込み**（`--sandbox read-only`）:
   ```bash
   cd /Users/keitaro_aigc/002project/202609-tokiwatari && codex exec --sandbox read-only "まだ実装しない。docs/codex-handoff.md と AGENTS.md・docs/HANDOVER.md を読み、目的/完了条件/対象/制約/質問の5点を返せ"
   ```
3. 質問に回答し「質問への回答」欄へ追記
4. **実装**（`--sandbox workspace-write`）:
   ```bash
   cd /Users/keitaro_aigc/002project/202609-tokiwatari && codex exec --sandbox workspace-write "[T159] docs/codex-handoff.md を読んで手順1から実装。ゴールコマンド npm run check 成功まで。不明点は停止して報告"
   ```
5. Claude側がゴールコマンドを再実行して検証 → コミット（`Refs #3`）・PR・記録
