import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReceiptUpdate } from '@/lib/supabase/types'

// PUT /api/receipts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body: ReceiptUpdate = await request.json()

  // date が変わった場合は month も更新
  if (body.date) {
    body.month = body.date.slice(0, 7)
  }

  const { data, error } = await supabase
    .from('receipts')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// DELETE /api/receipts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  // まず画像URLを取得（Storageから削除するため）
  const { data: receipt } = await supabase
    .from('receipts')
    .select('image_url')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Storage から画像を削除
  if (receipt?.image_url) {
    const path = receipt.image_url.split('/receipt-images/').at(-1)
    if (path) {
      await supabase.storage.from('receipt-images').remove([path])
    }
  }

  return NextResponse.json({ success: true })
}
