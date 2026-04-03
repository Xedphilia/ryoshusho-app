import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReceiptInsert } from '@/lib/supabase/types'

// GET /api/receipts?month=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

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

  return NextResponse.json({ success: true, data })
}

// POST /api/receipts
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const body: Omit<ReceiptInsert, 'user_id' | 'month'> = await request.json()

  const insert: ReceiptInsert = {
    ...body,
    month: body.date.slice(0, 7), // YYYY-MM
  }

  const { data, error } = await supabase.from('receipts').insert(insert).select().single()
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
