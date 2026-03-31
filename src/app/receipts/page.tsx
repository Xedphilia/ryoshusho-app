'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Download,
  Settings,
  LogOut,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ExternalLink,
  FileText,
} from 'lucide-react'
import type { Receipt, StoreName, Purpose } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { generatePdf } from '@/lib/pdf'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return `${y}年${parseInt(mo)}月`
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ReceiptsPage() {
  const router = useRouter()
  const [month, setMonth] = useState(currentMonth())
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [storeNames, setStoreNames] = useState<StoreName[]>([])
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [loading, setLoading] = useState(true)
  const [storePanelOpen, setStorePanelOpen] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadReceipts = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/receipts?month=${month}`)
    const json = await res.json()
    if (json.success) setReceipts(json.data)
    setLoading(false)
  }, [month])

  const loadStoreNames = useCallback(async () => {
    const res = await fetch('/api/store-names')
    const json = await res.json()
    if (json.success) setStoreNames(json.data)
  }, [])

  const loadPurposes = useCallback(async () => {
    const res = await fetch('/api/purposes')
    const json = await res.json()
    if (json.success) setPurposes(json.data)
  }, [])

  useEffect(() => {
    loadReceipts()
  }, [loadReceipts])

  useEffect(() => {
    loadStoreNames()
    loadPurposes()
  }, [loadStoreNames, loadPurposes])

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
  const flaggedCount = receipts.filter((r) => r.is_flagged).length

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  async function addStoreName() {
    if (!newStoreName.trim()) return
    await fetch('/api/store-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStoreName.trim() }),
    })
    setNewStoreName('')
    loadStoreNames()
  }

  async function deleteStoreName(id: string) {
    await fetch(`/api/store-names/${id}`, { method: 'DELETE' })
    loadStoreNames()
  }

  async function deleteReceipt(id: string) {
    if (!confirm('この領収書を削除しますか？')) return
    await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
    loadReceipts()
  }

  async function saveEdit() {
    if (!editingReceipt) return
    await fetch(`/api/receipts/${editingReceipt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: editingReceipt.date,
        amount: editingReceipt.amount,
        store_name: editingReceipt.store_name,
        item_name: editingReceipt.item_name,
        purpose: editingReceipt.purpose,
        payment_method: editingReceipt.payment_method,
        card_info: editingReceipt.card_info,
        is_flagged: false,
      }),
    })
    setEditingReceipt(null)
    loadReceipts()
  }

  async function exportXlsx() {
    setExporting(true)
    const res = await fetch(`/api/receipts/export?month=${month}&format=xlsx`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipts_${month}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  async function exportPdf() {
    setExporting(true)
    const res = await fetch(`/api/receipts/export?month=${month}&format=pdf`)
    const json = await res.json()
    if (json.success) {
      generatePdf(json.data, month)
    }
    setExporting(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          🧾 領収書整理
        </h1>
        <div className="flex items-center gap-2">
          {flaggedCount > 0 && (
            <button
              onClick={() => router.push('/receipts/review')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
              style={{ background: '#FEF3C7', color: '#92400E' }}
            >
              <AlertCircle size={12} />
              要確認 {flaggedCount}件
            </button>
          )}
          <button
            onClick={() => router.push('/settings')}
            className="p-2 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            title="設定"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            title="ログアウト"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* 月選択 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonth(prevMonth(month))}
            className="p-2 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={18} style={{ color: 'var(--text-primary)' }} />
          </button>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(nextMonth(month))}
            className="p-2 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <ChevronRight size={18} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        {/* 合計・アクションバー */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>合計金額</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              ¥{totalAmount.toLocaleString('ja-JP')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {receipts.length}件
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportXlsx}
              disabled={exporting || receipts.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
              style={{ background: '#E8F5E9', color: '#2E7D32' }}
              title="Excelで出力"
            >
              <Download size={15} />
              Excel
            </button>
            <button
              onClick={exportPdf}
              disabled={exporting || receipts.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
              style={{ background: '#FDE8E8', color: '#C62828' }}
              title="PDFで出力"
            >
              <FileText size={15} />
              PDF
            </button>
          </div>
        </div>

        {/* 店名パネル */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setStorePanelOpen(!storePanelOpen)}
          >
            <span>よく使う店名 ({storeNames.length}件)</span>
            {storePanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {storePanelOpen && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex gap-2 pt-3">
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStoreName()}
                  placeholder="店名を追加..."
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={addStoreName}
                  className="p-2 rounded-lg"
                  style={{ background: '#7C5CBF', color: '#fff' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {storeNames.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    {s.name}
                    <button onClick={() => deleteStoreName(s.id)}>
                      <Trash2 size={11} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                ))}
                {storeNames.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    店名を登録するとOCR精度が上がります
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 領収書テーブル */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              読み込み中...
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                この月の領収書はまだありません
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-primary)' }}>
                    {['日付', '金額', '店名', '品名', '用途', '支払', ''].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        borderColor: 'var(--border)',
                        background: r.is_flagged ? '#FFFBEB' : 'var(--bg-card)',
                      }}
                      onClick={() => setEditingReceipt(r)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        <span className="flex items-center gap-1">
                          {r.is_flagged && <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />}
                          {r.date}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: 'var(--text-primary)' }}>
                        ¥{r.amount.toLocaleString('ja-JP')}
                      </td>
                      <td className="px-3 py-2.5 max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {r.store_name}
                      </td>
                      <td className="px-3 py-2.5 max-w-[120px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {r.item_name ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 max-w-[100px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {r.purpose ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.payment_method === 'card'
                          ? r.card_info ? `カード(${r.card_info})` : 'カード'
                          : '現金'}
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          href={r.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="領収書画像を見る"
                        >
                          <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 撮影ボタン（FAB） */}
      <button
        onClick={() => router.push('/receipts/capture')}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: '#7C5CBF', color: '#fff' }}
        title="領収書を撮影"
      >
        <Camera size={24} />
      </button>

      {/* 編集モーダル */}
      {editingReceipt && (
        <EditModal
          receipt={editingReceipt}
          purposes={purposes}
          onChange={setEditingReceipt}
          onSave={saveEdit}
          onDelete={() => { deleteReceipt(editingReceipt.id); setEditingReceipt(null) }}
          onClose={() => setEditingReceipt(null)}
        />
      )}
    </div>
  )
}

// ── 編集モーダル ──────────────────────────────────────
interface EditModalProps {
  receipt: Receipt
  purposes: Purpose[]
  onChange: (r: Receipt) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

function EditModal({ receipt, purposes, onChange, onSave, onDelete, onClose }: EditModalProps) {
  function update(field: keyof Receipt, value: unknown) {
    onChange({ ...receipt, [field]: value })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>編集</h2>
          <a
            href={receipt.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs"
            style={{ color: '#7C5CBF' }}
          >
            <ExternalLink size={13} />
            画像を確認
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="日付">
            <input
              type="date"
              value={receipt.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="金額（円）">
            <input
              type="number"
              value={receipt.amount}
              onChange={(e) => update('amount', parseInt(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="店名" className="col-span-2">
            <input
              type="text"
              value={receipt.store_name}
              onChange={(e) => update('store_name', e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="品名" className="col-span-2">
            <input
              type="text"
              value={receipt.item_name ?? ''}
              onChange={(e) => update('item_name', e.target.value || null)}
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </Field>
          <Field label="用途">
            <select
              value={receipt.purpose ?? ''}
              onChange={(e) => update('purpose', e.target.value || null)}
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">未選択</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="支払方法">
            <select
              value={receipt.payment_method}
              onChange={(e) => update('payment_method', e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="cash">現金</option>
              <option value="card">カード</option>
            </select>
          </Field>
          {receipt.payment_method === 'card' && (
            <Field label="カード情報" className="col-span-2">
              <input
                type="text"
                value={receipt.card_info ?? ''}
                onChange={(e) => update('card_info', e.target.value || null)}
                placeholder="例: JCB 1139"
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </Field>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onDelete}
            className="p-2 rounded-xl"
            style={{ background: '#FDE8E8', color: '#C62828' }}
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: '#7C5CBF', color: '#fff' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
