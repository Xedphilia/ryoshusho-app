import { NextRequest, NextResponse } from 'next/server'
import type { OcrResult, PaymentMethod } from '@/lib/supabase/types'

interface GeminiOcrResponse {
  date: string | null
  amount: number | null
  store_name: string | null
  item_name: string | null
  payment_method: 'cash' | 'card'
  card_info: string | null
}

function buildFlagReasons(result: GeminiOcrResponse): string[] {
  const reasons: string[] = []
  if (!result.date) reasons.push('日付が読み取れませんでした')
  if (!result.amount) reasons.push('金額が読み取れませんでした')
  if (!result.store_name) reasons.push('店名が読み取れませんでした')
  return reasons
}

function toOcrResult(parsed: GeminiOcrResponse): OcrResult {
  const flagReasons = buildFlagReasons(parsed)
  return {
    date: parsed.date,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    store_name: parsed.store_name,
    item_name: parsed.item_name,
    payment_method: (['cash', 'card'].includes(parsed.payment_method)
      ? parsed.payment_method
      : 'cash') as PaymentMethod,
    card_info: parsed.card_info,
    is_flagged: flagReasons.length > 0,
    flag_reasons: flagReasons,
  }
}

// POST /api/receipts/classify
// body: { items: Array<{ text: string }>, store_names?: string[] }
// 複数テキストを1回のGeminiコールで分類する（バッチ処理）
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Gemini API key not configured' }, { status: 500 })
  }

  const body: { items: Array<{ text: string }>; store_names?: string[] } = await request.json()
  const { items, store_names } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ success: false, error: 'items is required' }, { status: 400 })
  }

  const storeNameHint =
    store_names && store_names.length > 0
      ? `\nよく利用される店名リスト（この中から該当するものを優先してください）: ${store_names.join('、')}`
      : ''

  // 複数領収書を1プロンプトにまとめる
  const receiptBlocks = items
    .map((item, i) => `--- 領収書${i + 1} ---\n${item.text}`)
    .join('\n\n')

  const prompt = `あなたは領収書OCRの専門家です。以下のテキストは領収書からOCRで抽出されたものです。
各領収書の情報を抽出してください。${storeNameHint}

抽出する項目:
- date: 日付（YYYY-MM-DD形式）
- amount: 金額（整数、円単位。税込合計金額を優先）
- store_name: 店名・会社名
- item_name: 品名・商品名・サービス名
- payment_method: 支払方法（現金なら"cash"、カードなら"card"）
- card_info: カード情報（カード種別と末尾番号、例: "JCB 1139"。現金の場合はnull）

${receiptBlocks}

必ず以下のJSON配列形式のみで返してください（他の文章は一切不要）:
[
  {
    "date": "YYYY-MM-DD" または null,
    "amount": 数値 または null,
    "store_name": "店名" または null,
    "item_name": "品名" または null,
    "payment_method": "cash" または "card",
    "card_info": "カード情報" または null
  }
]
配列の要素数は領収書の数（${items.length}個）と一致させてください。`

  const geminiBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, topK: 1, topP: 1 },
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  )

  if (!geminiRes.ok) {
    const errJson = await geminiRes.json().catch(() => null)
    const code = errJson?.error?.code
    const msg = errJson?.error?.message ?? 'Unknown error'
    let userFacingError = `Gemini APIエラー (${geminiRes.status})`
    if (code === 429) userFacingError = 'Gemini APIの利用上限に達しました。しばらく待ってから再試行してください'
    if (msg.includes('leaked')) userFacingError = 'GeminiのAPIキーが無効です。新しいAPIキーを発行して.env.localに設定してください'
    return NextResponse.json({ success: false, error: userFacingError }, { status: 500 })
  }

  const geminiData = await geminiRes.json()
  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsedArray: GeminiOcrResponse[]
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('JSON array not found in response')
    parsedArray = JSON.parse(jsonMatch[0]) as GeminiOcrResponse[]
    if (!Array.isArray(parsedArray)) throw new Error('Response is not an array')
  } catch {
    return NextResponse.json(
      { success: false, error: 'OCR結果の解析に失敗しました', raw: rawText },
      { status: 500 }
    )
  }

  const results: OcrResult[] = parsedArray.map(toOcrResult)

  return NextResponse.json({ success: true, data: results })
}
