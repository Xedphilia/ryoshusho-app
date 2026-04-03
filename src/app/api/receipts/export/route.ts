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

// 品名を改行区切りに変換
function formatItemName(name: string | null) {
  if (!name) return ''
  // 読点・中点・改行で分割してセル内改行
  return name.split(/[、，,・\n]/).map((s) => s.trim()).filter(Boolean).join('\n')
}

const ALL_COLUMNS = ['日付', '金額', '店名', '品名', '用途', '支払方法', '領収書画像'] as const
type ColName = typeof ALL_COLUMNS[number]

// GET /api/receipts/export?month=YYYY-MM&format=xlsx|pdf&columns=日付,金額,...
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? ''
  const format = searchParams.get('format') ?? 'xlsx'
  const columnsParam = searchParams.get('columns')
  const selectedCols: Set<ColName> = columnsParam
    ? new Set(columnsParam.split(',').filter((c): c is ColName => (ALL_COLUMNS as readonly string[]).includes(c)))
    : new Set(ALL_COLUMNS)

  let query = supabase
    .from('receipts')
    .select('*')
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
    const allData = {
      日付: (r: Receipt) => formatDate(r.date),
      金額: (r: Receipt) => r.amount,
      店名: (r: Receipt) => r.store_name,
      品名: (r: Receipt) => formatItemName(r.item_name),
      用途: (r: Receipt) => r.purpose ?? '',
      支払方法: (r: Receipt) => formatPayment(r.payment_method, r.card_info),
      領収書画像: (r: Receipt) => r.image_url ?? '',
    } satisfies Record<ColName, (r: Receipt) => unknown>

    const rows = receipts.map((r) => {
      const row: Record<string, unknown> = {}
      for (const col of ALL_COLUMNS) {
        if (selectedCols.has(col)) row[col] = allData[col](r)
      }
      return row
    })

    const ws = XLSX.utils.json_to_sheet(rows)

    // 品名セルに wrap text 適用
    const colWidths: Record<ColName, number> = {
      日付: 12, 金額: 12, 店名: 20, 品名: 24, 用途: 16, 支払方法: 18, 領収書画像: 50,
    }
    ws['!cols'] = ALL_COLUMNS.filter((c) => selectedCols.has(c)).map((c) => ({ wch: colWidths[c] }))

    // 品名列のセルに wrap text
    const selectedColsArr = ALL_COLUMNS.filter((c) => selectedCols.has(c))
    const itemColIdx = selectedColsArr.indexOf('品名')
    if (itemColIdx >= 0) {
      const colLetter = String.fromCharCode(65 + itemColIdx)
      for (let i = 2; i <= receipts.length + 1; i++) {
        const cellRef = `${colLetter}${i}`
        if (ws[cellRef]) {
          ws[cellRef].s = { alignment: { wrapText: true, vertical: 'top' } }
        }
      }
    }

    try {
      const wb = XLSX.utils.book_new()
      // シート名は31文字以内・特殊文字禁止・ASCII限定
      const sheetName = (month ? month : 'All').replace(/[:/\\?*[\]]/g, '-').substring(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })

      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="receipts_${month || 'all'}.xlsx"`,
        },
      })
    } catch (xlsxErr) {
      return NextResponse.json({ success: false, error: String(xlsxErr) }, { status: 500 })
    }
  }

  if (format === 'pdf') {
    // PDF生成はクライアント側で行うため、データのみ返す
    return NextResponse.json({ success: true, data: receipts })
  }

  return NextResponse.json({ success: false, error: 'Invalid format' }, { status: 400 })
}
