# DevStudio 引き継ぎ資料

> このファイルは Claude Code でのやり取り内容を DevStudio に引き継ぐための資料です。
> **毎回のセッション終了時に更新してください。**

---

## 最終更新: 2026-04-03（セッション4完了）

---

## 1. 現在のプロジェクト状態

### DevStudio 本体
- **URL**: http://localhost:3000
- **起動コマンド**: `npm run dev -- --webpack`（webpack必須・Turbopack非対応）
- **AI エンジン**: Claude CLI (haiku) + Gemini 2.5 Flash (OCR)
- **状態**: 正常稼働中

### 領収書整理アプリ (`/receipts`)
- **Supabase プロジェクトID**: `cmscinxcikabckdzvlgf`
- **ストレージバケット**: `receipt-images`（public）
- **OCR API**: Gemini 2.5 Flash（`gemini-2.5-flash`）
- **状態**: 主要機能実装完了・E2Eテスト未実施

---

## 2. 実装済み機能（全量）

### キャプチャ画面 (`/receipts/capture`)

| 機能 | 詳細 |
|------|------|
| カメラ撮影 / ファイル選択 | 1枚ずつ確認 or まとめて取込 |
| OCR（Gemini 2.5 Flash） | 日付・金額・店名・品名・支払方法を自動読み取り |
| ズーム機能 | 🔍ボタンで全画面展開、デフォルト150%、±25%刻みで調整可 |
| ズーム画面内でOCR直接編集 | 画像と入力フォームを同画面に表示・リアルタイム同期 |
| 用途入力モード | 「プルダウン」「自由入力」をトグルで切り替え |
| 保存後リダイレクト | 保存した領収書の月（`/receipts?month=YYYY-MM`）へ遷移 |
| 保存エラー表示 | 失敗時に画面にエラーメッセージを表示 |

### メイン画面 (`/receipts`)

| 機能 | 詳細 |
|------|------|
| 月別表示 | 前後ナビ・合計金額・件数・画像枚数 |
| QRコードモーダル | ヘッダーのスマホアイコン → `192.168.3.134:3000/receipts` のQR表示 |
| テーブル | 日付・金額・店名・品名・用途・支払方法・画像リンク・🗑️削除ボタン |
| 行クリック編集 | 編集モーダル（メモ・保存日時・各フィールド・削除ボタン付き） |
| 店名パネル | 追加・削除・検索フィルター・あいうえお順ソート |
| 用途パネル | 追加・削除（店名パネルの下） |
| Excel出力 | 列選択モーダル → 選択項目のみ出力（領収書画像はデフォルトOFF） |
| PDF出力 | 全項目を出力 |

### Excel出力 (`/api/receipts/export`)
- 品名の `、` 区切り → セル内改行（wrap text）に変換
- `columns=` クエリパラメータで出力列を制御

### 編集モーダル
- **メモ（title）**: 自由入力フィールド（例: 出張交通費・会議室代）
- **保存日時（created_at）**: 「保存: 2024年7月5日 14:30」形式で読み取り専用表示

### ハル（agentId=5）のE2E自動テスト
- プロジェクト引き継ぎ時に即座に自律E2Eテストを実行
- 手順: API疎通確認 → フロー手順化 → 問題リスト化 → ユーザーへ報告

---

## 3. 未対応・次回やること

### 優先度高
- [ ] **E2Eテスト実施**: ハルに「このアプリの一連動作を確認して」と依頼する
  - サンプルレシート画像（`/tmp/test_receipt.jpg`）が必要

### 優先度中
- [ ] 用途のあいうえお順ソート（店名には実装済み・用途にはまだ）
- [ ] PDF出力の列選択（現在Excelのみ対応）
- [ ] モバイル最適化（スマホカメラでの撮影フロー改善）

### 優先度低
- [ ] Vercelデプロイ（環境変数の本番設定）
- [ ] ミオのCodex化（OpenAIクレジット追加後に `agentId===4` の分岐を有効化）

---

## 4. ユーザーの設計思想（重要）

> このセクションはエージェントがユーザーの意図を汲み取るための情報です。

### 「動いてから改善」の原則
- 機能を実装したら必ずE2Eで動作確認する
- 動作未確認の機能への改善提案はしない
- ハルが最終動作確認担当（ログイン→OCR→保存→確認を自律実行）
- **「コードを見た限り問題ない」は禁止** — 必ず実機で再現するまで調査する

### 「コンピューターユーズで人間と同じ確認」の原則
- 原因調査・動作確認フェーズでは必ずブラウザを実際に操作して確認する
- エージェント（ハル・ミオ）は「＜ブラウザ確認依頼＞」フォーマットで確認項目を出力する
- 確認依頼を受けたらClaude Codeのコンピューターユーズで実際にブラウザ操作して検証する
- APIは curl で実機確認、UIは computer-use で実機確認が原則

### 「その場でできる」UI設計
- 削除はモーダルを開かずに行ボタンで
- 確認と編集は同じ画面（ズーム画面でOCR直接編集）
- 設定はアプリ内で完結（用途・店名の登録管理）
- 「増えるもの」には整理機能（ソート・検索）が必須

### 「DevStudio起点の開発」
- Claude Codeでの作業はあくまでつなぎ
- 全ての議論・変更・改善提案はDevStudioを通す
- 各セッションの内容は必ずこのHANDOFF.mdに反映する

### 「失敗を記録して学習」
- 何度も修正した箇所は必ずメモに残す
- 「なぜ失敗したか」「どう改善したか」を具体的に記録して同じ失敗を繰り返さない

---

## 5. 技術的注意事項

### Gemini API
- **使用モデル**: `gemini-2.5-flash`（`gemini-2.0-flash`はこのアカウントで limit:0・使用不可）
- **APIキー**: `.env.local` の `GEMINI_API_KEY`（プロジェクト: ryoshusho-app）
- **教訓**: 新しいAPIキーを作っても `gemini-2.0-flash` は動かない。モデルの問題

### Supabase
- **RLSポリシー**: receiptsテーブルとstorage.objectsに設定済み
- **バケット**: `receipt-images`（publicバケット）
- **認証**: Supabase SSR（`createClient` from `@/lib/supabase/server`）
- **DB スキーマ変更履歴**:
  - `receipt-images` バケット作成（2026-04-03 セッション1）
  - `receipts.title TEXT` カラム追加（2026-04-03 セッション2）

### モバイルアクセスのcookie設定（重要）
- `src/lib/supabase/server.ts` の `setAll` で `secure: false` が必須
  - ❌ これがないとセッション更新時に`Secure`フラグ付きcookieが設定される
  - ❌ モバイルブラウザはHTTPでは`Secure`cookieを送信しない → 401ループ
- `src/app/api/auth/login/route.ts` も同様に `secure: false` 設定済み
- ローカルIP: `.env.local` の `NEXT_PUBLIC_LOCAL_IP` で管理（IPが変わったら更新＋サーバー再起動）

### iOS タップ遅延・ダブルタップズーム対策（重要）
- `src/app/globals.css` に `touch-action: manipulation` を設定済み（2026-04-03 セッション3）
  - ❌ これがないとiOS Safariでボタンが押せない・ダブルタップでズームする
  - ✅ `button, a, input, select, textarea, [role="button"]` に適用
- 症状: ボタンが「押した感じがしない」「ダブルタップで写真みたいにズームする」
- 原因: iOSの300msタップ遅延 + double-tap-to-zoom がタッチイベントを飲み込む

### ★ Next.js 16 ローカルIP接続の必須設定（最重要・2026-04-03解決）

**症状:** スマホからアプリにアクセスすると「HTMLを見ているような感覚」でボタンが全く押せない
**誤診しやすい原因:** CSS（touch-action）・viewport（user-scalable）と思いがちだが全て無関係

**真の原因:** Next.js 16 のセキュリティ機能
- ローカルIP（`192.168.11.12`）からの `/_next/webpack-hmr` WebSocket接続がデフォルトでブロック
- webpack ランタイムが初期化失敗 → **Reactのイベントハンドラが全部アタッチされない**
- ページのHTML・CSSは届くが、JSが動かないので完全に静的HTML状態になる

**修正方法:** `next.config.ts` に `allowedDevOrigins` を追加
```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.11.12'],  // ← これがないとスマホからJS動かない
};
```
- IPが変わったら `.env.local` の `NEXT_PUBLIC_LOCAL_IP` と **この設定も両方更新** してサーバー再起動
- ✅ 確認コマンド: `npm run dev -- --webpack` 起動後にログに `Blocked cross-origin` が出ないこと

**サーバーログで見るべき警告（出たら即設定追加）:**
```
⚠ Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "xxx.xxx.xxx.xxx"
```

### DevStudioエージェント（重要）
- ハル(agentId=5)のシステムプロンプトに「GUI操作は不可・ファイル読み書きのみ可能」を明記済み
  - ❌ 「GUI操作可能」と書くと ツール呼び出し失敗 → exit code 1 で無言終了する
- stderrキャプチャ実装済み → `"Claude が終了しました (code 1): ..."` でエラー内容が見える
- ミオ(agentId=4): `callCodex()` 実装済みだが現在は無効（クレジット不足）

### 起動・開発
- `npm run dev` は必ず `--webpack` フラグ付き
- Supabase middlewareのmatcherは `/receipts/:path*` と `/auth/:path*` のみに限定
- `next.config.ts` の `allowedDevOrigins` にローカルIPを必ず設定すること（上記参照）

---

## 6. ファイル構成（主要）

```
devstudio/
├── .env.local                        # GEMINI_API_KEY, Supabase認証情報
├── HANDOFF.md                        # ← このファイル（毎回更新）
├── src/
│   ├── lib/supabase/types.ts         # Receipt型（title追加済み）
│   └── app/
│       ├── api/
│       │   ├── chat/route.ts         # DevStudio チャットAPI（エージェント7人・ハルE2E手順含む）
│       │   ├── receipts/
│       │   │   ├── route.ts          # 領収書 GET/POST
│       │   │   ├── [id]/route.ts     # 領収書 PUT/DELETE（title対応済み）
│       │   │   ├── ocr/route.ts      # Gemini OCR（2.5flash）
│       │   │   └── export/route.ts   # Excel/PDF出力（列選択対応）
│       │   ├── purposes/route.ts     # 用途マスタ
│       │   └── store-names/route.ts  # 店名マスタ
│       └── receipts/
│           ├── page.tsx              # メイン一覧（QRコード・title・created_at対応済み）
│           └── capture/page.tsx      # 撮影・OCR・確認（ズーム・モード切り替え対応済み）
```

---

## 7. E2Eテストチェックリスト（ハル担当・次回実施）

```
1. http://localhost:3000/receipts にアクセス
2. 未ログイン → /auth/login にリダイレクトされるか確認
3. ログイン（Supabaseアカウント）
4. /receipts/capture に移動
5. サンプルレシート画像（/tmp/test_receipt.jpg）をファイル選択でアップロード
6. OCRが実行され、日付・金額・店名が読み取られるか確認
7. 「1件保存」ボタンを押す
8. 保存後、対応する月の /receipts?month=YYYY-MM にリダイレクトされるか確認
9. 一覧に保存した領収書が表示されるか確認
10. 削除ボタンで削除できるか確認
```
