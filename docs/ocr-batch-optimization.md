# OCR高速化・バッチ最適化 実装メモ

**実施日**: 2026-04-03
**対象**: 領収書整理アプリ（`/receipts`）

---

## 背景・課題

| 課題 | 内容 |
|------|------|
| Gemini無料枠の制限 | `gemini-2.5-flash` は **20回/日** のRPD制限がある |
| 速度 | 画像をまるごとGeminiに送るためネットワーク待ちが発生 |
| バッチ非効率 | 5枚まとめて取り込んでもGeminiを5回呼んでいた |
| デプロイ対応 | Vercelなどクラウド環境でも動く構成が必要（PaddleOCRはサーバー必須で不可） |

---

## 解決策：Tesseract.js（ブラウザOCR）+ Gemini分類のバッチ化

### 変更前のフロー

```
画像（base64） → Gemini（OCR + 分類）→ Supabase保存
```

→ 1枚 = Gemini 1回消費

### 変更後のフロー

```
画像
 └─ Tesseract.js（ブラウザ内・無制限・ネットワーク不要）
         ↓ テキスト抽出
 └─ /api/receipts/classify（Gemini・テキストのみ送信）
         ↓ 店名・金額・日付などに分類
Supabase保存
```

→ **バッチ時は全枚のテキストを1回のGeminiコールにまとめる**

---

## Gemini消費比較

| シナリオ | 変更前 | 変更後 |
|---------|--------|--------|
| 1枚処理 | 1回 | 1回（画像→テキストのみに変化） |
| 5枚バッチ | 5回 | **1回** |
| 20枚バッチ | 20回（上限到達） | **1回** |
| 月末まとめ50枚 | 3日に分散必須 | 1日10回で余裕 |

---

## 変更ファイル一覧

### 新規作成

**`src/app/api/receipts/classify/route.ts`**
- テキスト配列を受け取り1回のGeminiコールで全件分類して返す新APIルート
- リクエスト形式: `{ items: Array<{ text: string }>, store_names?: string[] }`
- レスポンス形式: `{ success: true, data: OcrResult[] }`（配列）

### 変更

**`src/app/receipts/capture/page.tsx`**

1. `extractTextWithTesseract(blob)` 関数を追加（ブラウザ側OCR）
2. `runOcr` → Tesseract.js + classify APIの2段階に変更
3. `runBatchOcr` 関数を新規追加（全枚並列Tesseract → 1回classify）
4. `finishBatch` → `runBatchOcr` を呼ぶよう変更

**`src/app/receipts/page.tsx`**
- `useSearchParams` のSuspenseラッパー追加（ビルドエラー修正・今回の変更とは別）

### パッケージ追加

```bash
npm install tesseract.js
```

---

## Tesseract.jsの注意事項

- **初回実行時に日本語言語データ（`jpn`）をダウンロード**（約10MB）
  - 2回目以降はブラウザキャッシュが効く
- スマホでの処理時間は画像品質により **2〜8秒** 程度
- 手書き・極端に斜めな写真は精度が落ちる可能性あり
  - その場合はGemini（旧`/api/receipts/ocr`）にフォールバックする改修も検討可

---

## 旧APIルートの扱い

`/api/receipts/ocr`（画像をGeminiに直接送るルート）は**残存**。
手動フォールバックや他の用途で使う可能性があるため削除しない。

---

## デプロイ時の考慮事項

- Tesseract.jsはブラウザ内で完結するためサーバー側の変更不要
- `GEMINI_API_KEY` 環境変数はVercel側にも設定が必要
- Supabaseの `receipt-images` バケットのパブリック設定も確認すること
