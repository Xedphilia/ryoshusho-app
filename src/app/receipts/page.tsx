'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Download,
  Settings,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  ArrowUpAZ,
  Search,
  X,
  Smartphone,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Receipt, StoreName, Purpose } from '@/lib/supabase/types'
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

export default function ReceiptsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">読み込み中...</div>}>
      <ReceiptsPage />
    </Suspense>
  )
}

function ReceiptsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [month, setMonth] = useState(() => searchParams.get('month') ?? currentMonth())
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [storeNames, setStoreNames] = useState<StoreName[]>([])
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [loading, setLoading] = useState(true)
  const [storePanelOpen, setStorePanelOpen] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [storeSearch, setStoreSearch] = useState('')
  const [storeSorted, setStoreSorted] = useState(false)
  const [purposePanelOpen, setPurposePanelOpen] = useState(false)
  const [newPurposeName, setNewPurposeName] = useState('')
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportColumns, setExportColumns] = useState({
    日付: true, 金額: true, 店名: true, 品名: true, 用途: true, 支払方法: true, 領収書画像: false,
  })
  const [showExportModal, setShowExportModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  const loadReceipts = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/receipts?month=${month}`)
    if (res.status === 401) {
      router.push('/auth/login')
      return
    }
    const json = await res.json()
    if (json.success) setReceipts(json.data)
    setLoading(false)
  }, [month, router])

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

  async function addPurpose() {
    if (!newPurposeName.trim()) return
    await fetch('/api/purposes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPurposeName.trim() }),
    })
    setNewPurposeName('')
    loadPurposes()
  }

  async function deletePurpose(id: string) {
    await fetch(`/api/purposes/${id}`, { method: 'DELETE' })
    loadPurposes()
  }

  const displayedStoreNames = storeSorted
    ? [...storeNames].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    : storeNames

  const filteredStoreNames = storeSearch
    ? displayedStoreNames.filter((s) => s.name.includes(storeSearch))
    : displayedStoreNames

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
        title: editingReceipt.title,
        is_flagged: false,
      }),
    })
    setEditingReceipt(null)
    loadReceipts()
  }

  async function exportXlsx() {
    setExporting(true)
    setShowExportModal(false)
    const cols = Object.entries(exportColumns)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',')
    const res = await fetch(`/api/receipts/export?month=${month}&format=xlsx&columns=${encodeURIComponent(cols)}`)
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
            onClick={() => setShowQrModal(true)}
            className="p-2 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            title="スマホから開く"
          >
            <Smartphone size={18} />
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="p-2 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            title="設定"
          >
            <Settings size={18} />
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
              {receipts.length}件 · 画像{receipts.filter((r) => r.image_url).length}枚
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
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
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
                <button onClick={addStoreName} className="p-2 rounded-lg" style={{ background: '#7C5CBF', color: '#fff' }}>
                  <Plus size={16} />
                </button>
              </div>
              {/* 検索・ソートバー */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="検索..."
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <button
                  onClick={() => setStoreSorted((s) => !s)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: storeSorted ? '#7C5CBF' : 'var(--bg-primary)',
                    color: storeSorted ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${storeSorted ? '#7C5CBF' : 'var(--border)'}`,
                  }}
                  title="あいうえお順"
                >
                  <ArrowUpAZ size={13} />
                  あ→ん
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredStoreNames.map((s) => (
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
                {filteredStoreNames.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {storeSearch ? '該当なし' : '店名を登録するとOCR精度が上がります'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 用途パネル */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setPurposePanelOpen(!purposePanelOpen)}
          >
            <span>よく使う用途 ({purposes.length}件)</span>
            {purposePanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {purposePanelOpen && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex gap-2 pt-3">
                <input
                  type="text"
                  value={newPurposeName}
                  onChange={(e) => setNewPurposeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPurpose()}
                  placeholder="用途を追加..."
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
                <button onClick={addPurpose} className="p-2 rounded-lg" style={{ background: '#7C5CBF', color: '#fff' }}>
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {purposes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    {p.name}
                    <button onClick={() => deletePurpose(p.id)}>
                      <Trash2 size={11} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                ))}
                {purposes.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    用途を登録するとキャプチャ時に選択できます
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
                        <div className="flex items-center gap-2">
                          {r.image_url && (
                            <a
                              href={r.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="領収書画像を見る"
                            >
                              <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                            </a>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteReceipt(r.id) }}
                            title="削除"
                          >
                            <Trash2 size={14} style={{ color: '#C62828' }} />
                          </button>
                        </div>
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

      {/* Excel出力列選択モーダル */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>出力する項目を選択</h2>
              <button onClick={() => setShowExportModal(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="space-y-2">
              {(Object.keys(exportColumns) as Array<keyof typeof exportColumns>).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportColumns[col]}
                    onChange={(e) => setExportColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#7C5CBF' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{col}</span>
                  {col === '領収書画像' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>URL</span>
                  )}
                </label>
              ))}
            </div>
            <button
              onClick={exportXlsx}
              disabled={exporting}
              className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#7C5CBF', color: '#fff' }}
            >
              <Download size={15} />
              {exporting ? '出力中...' : 'Excelで出力'}
            </button>
          </div>
        </div>
      )}

      {/* スマホQRコードモーダル */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-6 space-y-4 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>スマホから開く</h2>
              <button onClick={() => setShowQrModal(false)}>
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG value={`http://${process.env.NEXT_PUBLIC_LOCAL_IP ?? '192.168.11.12'}:3000/receipts`} size={180} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              スマホのカメラでQRコードを読み取ると<br />同じWi-Fiネットワーク内でアクセスできます
            </p>
            <p className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              {process.env.NEXT_PUBLIC_LOCAL_IP ?? '192.168.11.12'}:3000/receipts
            </p>
          </div>
        </div>
      )}

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
          <div>
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>編集</h2>
            {receipt.created_at && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                保存: {new Date(receipt.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
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
          <Field label="メモ（タイトル）" className="col-span-2">
            <input
              type="text"
              value={receipt.title ?? ''}
              onChange={(e) => update('title', e.target.value || null)}
              placeholder="例: 出張交通費・会議室代など"
              className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </Field>
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
