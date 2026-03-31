'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import type { Purpose } from '@/lib/supabase/types'

export default function SettingsPage() {
  const router = useRouter()
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadPurposes = useCallback(async () => {
    const res = await fetch('/api/purposes')
    const json = await res.json()
    if (json.success) setPurposes(json.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadPurposes() }, [loadPurposes])

  async function addPurpose() {
    if (!newName.trim()) return
    const res = await fetch('/api/purposes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const json = await res.json()
    if (json.success) {
      setNewName('')
      loadPurposes()
    }
  }

  async function deletePurpose(id: string) {
    if (!confirm('この用途を削除しますか？')) return
    await fetch(`/api/purposes/${id}`, { method: 'DELETE' })
    loadPurposes()
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
        <h1 className="font-bold" style={{ color: 'var(--text-primary)' }}>設定</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        {/* 用途リスト管理 */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>用途リスト</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              領収書の用途をあらかじめ登録しておくと、入力時にドロップダウンで選べます
            </p>
          </div>

          {/* 追加フォーム */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPurpose()}
                placeholder="例: 消耗品費、接待費、交通費..."
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={addPurpose}
                disabled={!newName.trim()}
                className="px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ background: '#7C5CBF', color: '#fff' }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* リスト */}
          {loading ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              読み込み中...
            </div>
          ) : purposes.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              用途がまだ登録されていません
            </div>
          ) : (
            <ul>
              {purposes.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
                >
                  <GripVertical size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                  <button
                    onClick={() => deletePurpose(p.id)}
                    className="p-1.5 rounded-lg"
                    style={{ background: '#FDE8E8', color: '#C62828' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* デフォルト用途のサジェスト */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            よく使われる用途
          </p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PURPOSES.map((name) => (
              <button
                key={name}
                onClick={async () => {
                  if (purposes.some((p) => p.name === name)) return
                  await fetch('/api/purposes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                  })
                  loadPurposes()
                }}
                disabled={purposes.some((p) => p.name === name)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_PURPOSES = [
  '消耗品費',
  '接待交際費',
  '交通費',
  '通信費',
  '家電・機器',
  '書籍・資料',
  '会議費',
  '福利厚生費',
  '広告宣伝費',
  '外注費',
]
