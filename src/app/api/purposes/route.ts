import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/purposes
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('purposes')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// POST /api/purposes
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { name }: { name: string } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: '用途名を入力してください' }, { status: 400 })
  }

  // 現在の最大 sort_order を取得
  const { data: existing } = await supabase
    .from('purposes')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('purposes')
    .insert({ name: name.trim(), sort_order: nextOrder })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
