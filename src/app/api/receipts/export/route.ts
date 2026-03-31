import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Receipt } from '@/lib/supabase/types'
import * as XLSX from 'xlsx'

function formatDate(d: string) {
  return d ? d.replace(/-/g, '/') : ''
}

function formatAmount(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`
}

function formatPayment(method: string, cardInfo: string | null) {
  if (method === 'card') {
    return cardInfo ? `カード (${cardInfo})` : 'カード'
  }
  return '現金'
}

// GET /api/receipts/export?month=YYYY-MM&format=xlsx|pdf
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? ''
  const format = searchParams.get('format') ?? 'xlsx'

  let query = supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  if (month) {
    query = query.eq('month', month)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const receipts: Receipt[] = data ?? []
  const label = month || '全期間'

  if (format === 'xlsx') {
    const rows = receipts.map((r) => ({
      日付: formatDate(r.date),
      金額: r.amount,
      店名: r.store_name,
      品名: r.item_name ?? '',
      用途: r.purpose ?? '',
      支払方法: formatPayment(r.payment_method, r.card_info),
      領収書画像: r.image_url,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)

    // 列幅の設定
    ws['!cols'] = [
      { wch: 12 }, // 日付
      { wch: 12 }, // 金額
      { wch: 20 }, // 店名
      { wch: 20 }, // 品名
      { wch: 16 }, // 用途
      { wch: 18 }, // 支払方法
      { wch: 50 }, // 画像URL
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, label)

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="receipts_${label}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    // PDF生成はクライアント側で行うため、データのみ返す
    return NextResponse.json({ success: true, data: receipts })
  }

  return NextResponse.json({ success: false, error: 'Invalid format' }, { status: 400 })
}
