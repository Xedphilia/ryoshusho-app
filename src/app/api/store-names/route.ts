import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/store-names
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('store_names')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// POST /api/store-names
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { name }: { name: string } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: '店名を入力してください' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('store_names')
    .upsert({ name: name.trim() }, { onConflict: 'name' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
