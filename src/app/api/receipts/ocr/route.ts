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

// 複数枚領収書対応: GeminiがJSON配列を返す場合もある
type GeminiOcrResponseOrArray = GeminiOcrResponse | GeminiOcrResponse[]

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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Gemini API key not configured' }, { status: 500 })
  }

  const body: { image_base64: string; mime_type: string; store_names?: string[] } = await request.json()

  const storeNameHint =
    body.store_names && body.store_names.length > 0
      ? `\nよく利用される店名リスト（この中から該当するものを優先してください）: ${body.store_names.join('、')}`
      : ''

  const prompt = `あなたは領収書OCRの専門家です。この画像の中にある領収書を全て検出し、それぞれから情報を抽出してください。

抽出する項目（各領収書について）:
- date: 日付（YYYY-MM-DD形式）
- amount: 金額（整数、円単位）
- store_name: 店名・会社名
- item_name: 品名・商品名・サービス名
- payment_method: 支払方法（現金なら"cash"、カードなら"card"）
- card_info: カード情報（カード種別と末尾番号、例: "JCB 1139"。現金の場合はnull）${storeNameHint}

必ず以下のルールに従ってください:
1. 画像に領収書が1枚だけの場合: JSONオブジェクト1つで返す
2. 画像に領収書が複数枚ある場合: JSON配列で返す（各要素が1枚分）
3. 他の文章は不要。JSONのみ返す

1枚の場合の形式:
{
  "date": "YYYY-MM-DD" または null,
  "amount": 数値 または null,
  "store_name": "店名" または null,
  "item_name": "品名" または null,
  "payment_method": "cash" または "card",
  "card_info": "カード情報" または null
}

複数枚の場合の形式:
[
  { "date": ..., "amount": ..., "store_name": ..., "item_name": ..., "payment_method": ..., "card_info": ... },
  { "date": ..., "amount": ..., "store_name": ..., "item_name": ..., "payment_method": ..., "card_info": ... }
]`

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
    if (code === 429) userFacingError = 'Gemini APIの利用上限に達しました。APIキーのクォータを確認してください'
    if (msg.includes('leaked')) userFacingError = 'GeminiのAPIキーが無効です。新しいAPIキーを発行して.env.localに設定してください'
    return NextResponse.json({ success: false, error: userFacingError }, { status: 500 })
  }

  const geminiData = await geminiRes.json()
  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsedRaw: GeminiOcrResponseOrArray
  try {
    // 配列またはオブジェクト形式のJSONを抽出
    const arrayMatch = rawText.match(/\[[\s\S]*\]/)
    const objectMatch = rawText.match(/\{[\s\S]*\}/)
    // 配列を優先してチェック
    if (arrayMatch) {
      parsedRaw = JSON.parse(arrayMatch[0]) as GeminiOcrResponse[]
    } else if (objectMatch) {
      parsedRaw = JSON.parse(objectMatch[0]) as GeminiOcrResponse
    } else {
      throw new Error('JSON not found in response')
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'OCR結果の解析に失敗しました', raw: rawText },
      { status: 500 }
    )
  }

  // 配列・単一オブジェクトの両方に対応
  const parsedList: GeminiOcrResponse[] = Array.isArray(parsedRaw) ? parsedRaw : [parsedRaw]

  const results: OcrResult[] = parsedList.map((parsed) => {
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
  })

  // 後方互換性: 1件の場合は単一オブジェクト、複数の場合は配列で返す
  if (results.length === 1) {
    return NextResponse.json({ success: true, data: results[0] })
  }
  return NextResponse.json({ success: true, data: results, multiple: true })
}
