'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle, CheckCircle, ExternalLink, Save } from 'lucide-react'
import type { Receipt, Purpose } from '@/lib/supabase/types'

export default function ReviewPage() {
  const router = useRouter()
  const [flagged, setFlagged] = useState<Receipt[]>([])
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [edits, setEdits] = useState<Record<string, Receipt>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const loadFlagged = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/receipts')
    const json = await res.json()
    if (json.success) {
      const items: Receipt[] = (json.data as Receipt[]).filter((r) => r.is_flagged)
      setFlagged(items)
      const initEdits: Record<string, Receipt> = {}
      items.forEach((r) => { initEdits[r.id] = { ...r } })
      setEdits(initEdits)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFlagged()
    fetch('/api/purposes').then((r) => r.json()).then((j) => { if (j.success) setPurposes(j.data) })
  }, [loadFlagged])

  function updateEdit(id: string, field: keyof Receipt, value: unknown) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  async function saveReceipt(id: string) {
    setSaving((prev) => ({ ...prev, [id]: true }))
    const r = edits[id]
    await fetch(`/api/receipts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: r.date,
        amount: r.amount,
        store_name: r.store_name,
        item_name: r.item_name,
        purpose: r.purpose,
        payment_method: r.payment_method,
        card_info: r.card_info,
        is_flagged: false,
      }),
    })
    setSaving((prev) => ({ ...prev, [id]: false }))
    setFlagged((prev) => prev.filter((x) => x.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => router.back()}>
          <ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} />
        </button>
        <h1 className="font-bold" style={{ color: 'var(--text-primary)' }}>
          要確認リスト
        </h1>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{ background: '#FEF3C7', color: '#92400E' }}
        >
          {flagged.length}件
        </span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {flagged.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <CheckCircle size={40} className="text-green-500" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              確認が必要な領収書はありません
            </p>
            <button
              onClick={() => router.push('/receipts')}
              className="mt-2 text-sm px-4 py-2 rounded-xl"
              style={{ background: '#7C5CBF', color: '#fff' }}
            >
              ホームへ戻る
            </button>
          </div>
        ) : (
          flagged.map((r) => {
            const edit = edits[r.id] ?? r
            return (
              <div
                key={r.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                {/* ヘッダー */}
                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{ background: '#FEF3C7' }}
                >
                  <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#92400E' }}>
                    <AlertCircle size={14} />
                    要確認
                  </div>
                  <a
                    href={r.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs"
                    style={{ color: '#92400E' }}
                  >
                    <ExternalLink size={12} />
                    元画像
                  </a>
                </div>

                {/* 2カラムレイアウト（PCでは左右、モバイルは上下） */}
                <div className="flex flex-col sm:flex-row">
                  {/* 画像 */}
                  <div className="sm:w-48 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.image_url}
                      alt="領収書"
                      className="w-full h-40 sm:h-full object-contain"
                      style={{ background: '#f5f5f5' }}
                    />
                  </div>

                  {/* フォーム */}
                  <div className="flex-1 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <ReviewField label="日付" required={!edit.date}>
                        <input
                          type="date"
                          value={edit.date}
                          onChange={(e) => updateEdit(r.id, 'date', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                      </ReviewField>
                      <ReviewField label="金額（円）" required={!edit.amount}>
                        <input
                          type="number"
                          value={edit.amount}
                          onChange={(e) => updateEdit(r.id, 'amount', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                      </ReviewField>
                      <ReviewField label="店名" required={!edit.store_name} className="col-span-2">
                        <input
                          type="text"
                          value={edit.store_name}
                          onChange={(e) => updateEdit(r.id, 'store_name', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                      </ReviewField>
                      <ReviewField label="品名" className="col-span-2">
                        <input
                          type="text"
                          value={edit.item_name ?? ''}
                          onChange={(e) => updateEdit(r.id, 'item_name', e.target.value || null)}
                          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                      </ReviewField>
                      <ReviewField label="用途">
                        <select
                          value={edit.purpose ?? ''}
                          onChange={(e) => updateEdit(r.id, 'purpose', e.target.value || null)}
                          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        >
                          <option value="">未選択</option>
                          {purposes.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </ReviewField>
                      <ReviewField label="支払方法">
                        <select
                          value={edit.payment_method}
                          onChange={(e) => updateEdit(r.id, 'payment_method', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        >
                          <option value="cash">現金</option>
                          <option value="card">カード</option>
                        </select>
                      </ReviewField>
                      {edit.payment_method === 'card' && (
                        <ReviewField label="カード情報" className="col-span-2">
                          <input
                            type="text"
                            value={edit.card_info ?? ''}
                            onChange={(e) => updateEdit(r.id, 'card_info', e.target.value || null)}
                            placeholder="例: JCB 1139"
                            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                          />
                        </ReviewField>
                      )}
                    </div>

                    <button
                      onClick={() => saveReceipt(r.id)}
                      disabled={saving[r.id] || !edit.date || !edit.amount || !edit.store_name}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                      style={{ background: '#7C5CBF', color: '#fff' }}
                    >
                      <Save size={15} />
                      {saving[r.id] ? '保存中...' : '確認済みにして保存'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ReviewField({
  label, required, children, className = '',
}: {
  label: string; required?: boolean; children: React.ReactNode; className?: string
}) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}
