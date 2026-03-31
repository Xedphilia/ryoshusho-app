# DevStudio — 引き継ぎドキュメント

最終更新: 2026-04-01

---

## プロジェクト概要

7人のAIエージェントキャラ（ルカ→レン→コウ→ミオ→ハル）と会話しながらアプリを作るNext.jsアプリ。

- **場所**: `~/claude_setup/devstudio/`
- **GitHub**: https://github.com/Xedphilia/ryoshusho-app
- **本番URL**: https://devstudio-ble0xeglj-xedphilias-projects.vercel.app
- **ローカル起動**: `cd ~/claude_setup/devstudio && npm run dev --webpack`（`--webpack` 必須）

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16（webpack mode） |
| 言語 | TypeScript strict / React 19 |
| スタイル | Tailwind CSS 4 |
| AI | `claude` CLI を `spawn()` で呼び出し |
| DB | `data/projects.json`（ファイル永続化） |
| 認証 | Supabase SSR（`@supabase/ssr`） |
| デプロイ | Vercel（GitHub連携で自動デプロイ） |

---

## エージェント一覧

| ID | 名前 | 役割 |
|----|------|------|
| 0 | ソラ | 全体進行・相談役（常時） |
| 1 | ルカ | アイデア整理・要件決め |
| 2 | レン | 画面・機能設計 |
| 3 | コウ | 実装（コードを書く）← 自動デプロイはここ |
| 4 | ミオ | 動作確認・バグ出し |
| 5 | ハル | 最終チェック・改善提案 |
| 6 | カイ | 完成後の修正・追加（常時） |

---

## 主要ファイル

```
src/
├── app/
│   ├── projects/[id]/page.tsx   ★ チャット画面（最も変更が多いファイル）
│   ├── agents/[id]/page.tsx     エージェントプロフィール
│   └── api/
│       ├── chat/route.ts        ★ Claude CLI呼び出し・システムプロンプト
│       ├── deploy/route.ts      ★ Vercel自動デプロイ
│       └── projects/[id]/complete/route.ts  フェーズ完了API
├── components/
│   ├── agents/AgentAvatar.tsx   顔SVGアバター
│   └── SetupGuide.tsx           初回セットアップガイド（モーダル）
└── lib/
    ├── agents.ts    全エージェント定義
    ├── types.ts     型定義（AgentId=0|1|2|3|4|5|6）
    └── projects.ts  JSONファイルCRUD
```

---

## コウ完了時の自動デプロイ（主要機能）

### 動作フロー
1. ユーザーがコウのフェーズ完了ボタンを押す（またはチャットで「OK」）
2. フェーズ完了APIが呼ばれる
3. ミオ（QAフェーズ）に自動移行
4. `/api/deploy` が自動呼び出され Vercel にデプロイ
5. ミオのチャットに「実装完了！デプロイ済みです。URL: https://...」と表示される

### 実装箇所: `src/app/projects/[id]/page.tsx`

```typescript
async function handleCompleteStep() {
  const wasKou = activeAgent === 3;
  // ... フェーズ完了API呼び出し ...
  if (wasKou) {
    setDeploying(true);
    const deployRes = await fetch("/api/deploy", { method: "POST" });
    const deployJson = await deployRes.json();
    if (deployJson.success && deployJson.url) {
      setDeployUrl(deployJson.url);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `実装が完了しました！デプロイ済みです。\n${deployJson.url}`,
      }]);
    }
    setDeploying(false);
  }
}
```

### デプロイAPI: `src/app/api/deploy/route.ts`
- git add/commit/push（リモートがある場合）
- `vercel deploy --prod -y` を実行
- URLを正規表現で抽出して返す

---

## AIシステムプロンプトのルール（`src/app/api/chat/route.ts`）

### コウへの絶対禁止事項
以下はどんな状況でも案内しない：
- `.env.local` の編集・環境変数の手動設定
- `npm run dev` / `npm install` 等のコマンド
- Supabaseのプロジェクト作成・SQL実行・設定手順
- `localhost` での動作確認方法
- 「動かす前にやること」系の案内

コウのフェーズ完了時のセリフ：「実装完了です。フェーズ完了ボタンを押してください（自動でVercelにデプロイされます）」

---

## メッセージレンダラー（`page.tsx` 上部）

AIのテキストをリッチ表示する関数群：
- `**太字**` → `<strong>`
- `` `コード` `` → `<code>`（内側がURLならリンク化）
- `https://...` → クリッカブルリンク（プレースホルダーは除外）
- サービス名自動リンク（`SERVICE_LINKS` 配列）→ Supabaseダッシュボード等を自動でリンク化
- ` ``` ` コードブロック → 薄紫背景（#F5F2FC）でプレーンテキスト表示
- 番号付きリスト・箇条書きをパース

---

## 環境変数

### ローカル（`.env.local`）
```
NEXT_PUBLIC_SUPABASE_URL=https://cmscinxcikabckdzvlgf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIzaSyATMPLVOrzDP6oded1ZgjHmrUMZL10x3gA
```

### Vercel（設定済み）
上記3つをVercelダッシュボードで設定済み。

---

## ミドルウェア注意点（`src/middleware.ts`）

Supabaseミドルウェアのmatcherを **`/receipts/:path*`** と **`/auth/:path*`** のみに限定している。

これをしないと `/projects/*` でSupabase URL未設定エラーが発生する。

---

## 既知の問題

| 問題 | 状況 |
|------|------|
| AIが移行フレーズを使わない場合、自動移行が機能しない | 手動ボタンで対応可 |
| コウへの「全部実装」は10分かかることがある | 正常動作（タイムアウト設定済み） |
| `/api/deploy` のVercel CLIはローカル認証に依存 | Vercelサーバー上では動作しない。ローカル実行前提 |

---

## セットアップガイド（`src/components/SetupGuide.tsx`）

プロジェクト一覧ページのヘッダーに「📋 起動手順」ボタンとして表示されるモーダル。
Supabase設定〜ログインまでの9ステップを詳細に説明している。

### 手順の流れ
1. Supabase アカウント作成/ログイン
2. 新しいプロジェクト作成（Tokyo リージョン推奨）
3. SQL Editor でテーブル構築（supabase-schema.sql を貼り付けて Run）
4. Storage バケット作成（receipt-images、Public: OFF）
5. URL と API Key を取得（Settings → API）
6. .env.local に書き込み（隠しファイル表示: Command + Shift + .）
7. 開発サーバー起動（`npm run dev --webpack`）
8. Supabase で Authentication → Users からユーザー作成
9. localhost:3000/auth/login でログイン

### 注意点
- .env.local は隠しファイルなので Finder では Command + Shift + . で表示する
- supabase-schema.sql は `~/claude_setup/devstudio/supabase-schema.sql` にある
- サーバーは起動したまま閉じない

---

## 次のセッションでやること（TODO）

- [ ] コウのチャットで自動デプロイ中のスピナー表示（現在はミオに移行後に完了メッセージのみ）
- [ ] デプロイが失敗した場合のリトライUIを追加
- [ ] `/api/deploy` をVercel環境でも動くようにする（GitHub Actions等を検討）
- [ ] Supabase セットアップを `/api/setup` で完全自動化する（Supabase Management API + Vercel API を使用）
