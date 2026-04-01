import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

// POST /api/receipts/ocr
// body: { image_base64: string, mime_type: string, store_names?: string[] }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Gemini API key not configured' }, { status: 500 })
  }

  const body: { image_base64: string; mime_type: string; store_names?: string[] } = await request.json()

  const storeNameHint =
    body.store_names && body.store_names.length > 0
      ? `\nよく利用される店名リスト（この中から該当するものを優先してください）: ${body.store_names.join('、')}`
      : ''

  const prompt = `あなたは領収書OCRの専門家です。この領収書の画像から以下の情報を抽出してください。

抽出する項目:
- date: 日付（YYYY-MM-DD形式）
- amount: 金額（整数、円単位）
- store_name: 店名・会社名
- item_name: 品名・商品名・サービス名
- payment_method: 支払方法（現金なら"cash"、カードなら"card"）
- card_info: カード情報（カード種別と末尾番号、例: "JCB 1139"。現金の場合はnull）${storeNameHint}

必ず以下のJSON形式のみで返してください（他の文章は不要）:
{
  "date": "YYYY-MM-DD" または null,
  "amount": 数値 または null,
  "store_name": "店名" または null,
  "item_name": "品名" または null,
  "payment_method": "cash" または "card",
  "card_info": "カード情報" または null
}`

  const geminiBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: body.mime_type,
              data: body.image_base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 1,
    },
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  )

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    return NextResponse.json({ success: false, error: `Gemini API error: ${errText}` }, { status: 500 })
  }

  const geminiData = await geminiRes.json()
  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsed: GeminiOcrResponse
  try {
    // JSON部分だけ抽出（余計な文字があっても対応）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found in response')
    parsed = JSON.parse(jsonMatch[0]) as GeminiOcrResponse
  } catch {
    return NextResponse.json(
      { success: false, error: 'OCR結果の解析に失敗しました', raw: rawText },
      { status: 500 }
    )
  }

  const flagReasons = buildFlagReasons(parsed)
  const result: OcrResult = {
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

  return NextResponse.json({ success: true, data: result })
}
