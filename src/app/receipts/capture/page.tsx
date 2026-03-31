'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  RotateCcw,
  Save,
  Layers,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OcrResult, Purpose, StoreName } from '@/lib/supabase/types'

type Mode = 'select' | 'camera' | 'preview' | 'ocr' | 'confirm'
type CaptureMode = 'single' | 'batch'

interface CaptureItem {
  imageBlob: Blob
  imageUrl: string // object URL for preview
  ocrResult: OcrResult | null
  purpose: string
  processing: boolean
  error: string | null
}

export default function CapturePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [captureMode, setCaptureMode] = useState<CaptureMode>('single')
  const [mode, setMode] = useState<Mode>('select')
  const [items, setItems] = useState<CaptureItem[]>([])
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [storeNames, setStoreNames] = useState<StoreName[]>([])
  const [cameraReady, setCameraReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentEditIndex, setCurrentEditIndex] = useState(0)

  useEffect(() => {
    fetch('/api/purposes').then((r) => r.json()).then((j) => { if (j.success) setPurposes(j.data) })
    fetch('/api/store-names').then((r) => r.json()).then((j) => { if (j.success) setStoreNames(j.data) })
  }, [])

  // カメラ起動
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraReady(true)
        }
      }
    } catch {
      alert('カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。')
      router.back()
    }
  }, [router])

  // カメラ停止
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  useEffect(() => {
    if (mode === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [mode, startCamera])

  // 撮影
  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const newItem: CaptureItem = {
          imageBlob: blob,
          imageUrl: url,
          ocrResult: null,
          purpose: '',
          processing: false,
          error: null,
        }
        setItems((prev) => [...prev, newItem])

        if (captureMode === 'single') {
          stopCamera()
          setMode('confirm')
          setCurrentEditIndex(0)
          runOcr(0, blob)
        }
        // batch モードはカメラを継続
      },
      'image/jpeg',
      0.92
    )
  }

  // ファイル選択
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const newItems: CaptureItem[] = files.map((f) => ({
      imageBlob: f,
      imageUrl: URL.createObjectURL(f),
      ocrResult: null,
      purpose: '',
      processing: false,
      error: null,
    }))
    setItems(newItems)
    setMode('confirm')
    setCurrentEditIndex(0)
    // 全件OCRを並列実行
    newItems.forEach((_, i) => runOcr(i, files[i]))
  }

  // OCR実行
  async function runOcr(index: number, blob: Blob) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, processing: true, error: null } : item))
    )

    try {
      const base64 = await blobToBase64(blob)
      const storeNameList = storeNames.map((s) => s.name)
      const res = await fetch('/api/receipts/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          mime_type: blob.type || 'image/jpeg',
          store_names: storeNameList,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setItems((prev) =>
          prev.map((item, i) =>
            i === index
              ? { ...item, ocrResult: json.data, processing: false }
              : item
          )
        )
      } else {
        setItems((prev) =>
          prev.map((item, i) =>
            i === index
              ? { ...item, error: 'OCRに失敗しました', processing: false }
              : item
          )
        )
      }
    } catch {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, error: 'OCRに失敗しました', processing: false }
            : item
        )
      )
    }
  }

  // バッチ完了 → 確認画面へ
  function finishBatch() {
    if (items.length === 0) return
    stopCamera()
    setMode('confirm')
    setCurrentEditIndex(0)
    // 未OCRのものを全部実行
    items.forEach((item, i) => {
      if (!item.ocrResult && !item.processing) {
        runOcr(i, item.imageBlob)
      }
    })
  }

  // 保存
  async function saveAll() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    let successCount = 0
    for (const item of items) {
      if (!item.ocrResult?.date || !item.ocrResult?.amount || !item.ocrResult?.store_name) continue
      try {
        // Storage にアップロード
        const ext = 'jpg'
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('receipt-images')
          .upload(path, item.imageBlob, { contentType: 'image/jpeg' })

        if (uploadError) continue

        const { data: urlData } = supabase.storage.from('receipt-images').getPublicUrl(path)
        const imageUrl = urlData.publicUrl

        // DB に保存
        const ocr = item.ocrResult
        await fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: ocr.date,
            amount: ocr.amount,
            store_name: ocr.store_name,
            item_name: ocr.item_name,
            purpose: item.purpose || null,
            payment_method: ocr.payment_method,
            card_info: ocr.card_info,
            image_url: imageUrl,
            is_flagged: ocr.is_flagged,
            month: ocr.date!.slice(0, 7),
          }),
        })
        successCount++
      } catch {
        // 個別エラーは無視して続行
      }
    }

    setSaving(false)
    // Object URLをクリーンアップ
    items.forEach((item) => URL.revokeObjectURL(item.imageUrl))
    router.push('/receipts')
  }

  // ── レンダリング ──
  if (mode === 'select') {
    return (
      <SelectModeScreen
        captureMode={captureMode}
        onSelectMode={setCaptureMode}
        onCamera={() => setMode('camera')}
        onFile={(e) => handleFileSelect(e)}
        onBack={() => router.back()}
      />
    )
  }

  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <button onClick={() => { stopCamera(); setMode('select') }} className="p-2 rounded-full bg-black/40 text-white">
            <ArrowLeft size={20} />
          </button>
          {captureMode === 'batch' && (
            <div className="flex items-center gap-2">
              <span className="text-white text-sm bg-black/40 px-2 py-1 rounded-full">
                {items.length}枚撮影済み
              </span>
              {items.length > 0 && (
                <button
                  onClick={finishBatch}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ background: '#7C5CBF', color: '#fff' }}
                >
                  確認へ
                </button>
              )}
            </div>
          )}
        </div>

        <video ref={videoRef} className="flex-1 object-cover w-full" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-10">
          <button
            onClick={capture}
            disabled={!cameraReady}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-40 transition-transform active:scale-95"
          />
        </div>
      </div>
    )
  }

  if (mode === 'confirm') {
    const item = items[currentEditIndex]
    if (!item) return null

    return (
      <ConfirmScreen
        items={items}
        currentIndex={currentEditIndex}
        purposes={purposes}
        saving={saving}
        onIndexChange={setCurrentEditIndex}
        onUpdateOcr={(i, field, value) => {
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, ocrResult: it.ocrResult ? { ...it.ocrResult, [field]: value } : it.ocrResult }
                : it
            )
          )
        }}
        onUpdatePurpose={(i, value) => {
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, purpose: value } : it))
          )
        }}
        onRetryOcr={(i) => runOcr(i, items[i].imageBlob)}
        onRemove={(i) => {
          URL.revokeObjectURL(items[i].imageUrl)
          setItems((prev) => prev.filter((_, idx) => idx !== i))
          setCurrentEditIndex(Math.max(0, i - 1))
        }}
        onSave={saveAll}
        onBack={() => setMode('select')}
      />
    )
  }

  return null
}

// ── モード選択画面 ──────────────────────────────────────
interface SelectModeScreenProps {
  captureMode: CaptureMode
  onSelectMode: (m: CaptureMode) => void
  onCamera: () => void
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBack: () => void
}

function SelectModeScreen({ captureMode, onSelectMode, onCamera, onFile, onBack }: SelectModeScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={onBack}>
          <ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} />
        </button>
        <h1 className="font-bold" style={{ color: 'var(--text-primary)' }}>領収書を取り込む</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* モード選択 */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>取り込みモード</p>
          <div className="grid grid-cols-2 gap-2">
            {(['single', 'batch'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onSelectMode(m)}
                className="py-3 px-4 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: captureMode === m ? '#7C5CBF' : 'var(--bg-primary)',
                  color: captureMode === m ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${captureMode === m ? '#7C5CBF' : 'var(--border)'}`,
                }}
              >
                {m === 'single' ? (
                  <span className="flex flex-col items-center gap-1">
                    <Camera size={18} />
                    1枚ずつ確認
                  </span>
                ) : (
                  <span className="flex flex-col items-center gap-1">
                    <Layers size={18} />
                    まとめて取込
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {captureMode === 'single'
              ? '1枚撮るたびにOCR結果を確認・修正できます'
              : '複数枚を連続で撮影してまとめて確認します'}
          </p>
        </div>

        {/* カメラ起動 */}
        <button
          onClick={onCamera}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-base font-bold"
          style={{ background: '#7C5CBF', color: '#fff' }}
        >
          <Camera size={22} />
          カメラで撮影
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>または</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* ファイル選択 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-base font-medium"
          style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', color: 'var(--text-muted)' }}
        >
          <Upload size={20} />
          画像ファイルを選択
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={captureMode === 'batch'}
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  )
}

// ── 確認画面 ──────────────────────────────────────────
interface ConfirmScreenProps {
  items: CaptureItem[]
  currentIndex: number
  purposes: Purpose[]
  saving: boolean
  onIndexChange: (i: number) => void
  onUpdateOcr: (i: number, field: string, value: unknown) => void
  onUpdatePurpose: (i: number, value: string) => void
  onRetryOcr: (i: number) => void
  onRemove: (i: number) => void
  onSave: () => void
  onBack: () => void
}

function ConfirmScreen({
  items, currentIndex, purposes, saving,
  onIndexChange, onUpdateOcr, onUpdatePurpose, onRetryOcr, onRemove, onSave, onBack,
}: ConfirmScreenProps) {
  const item = items[currentIndex]
  const ocr = item?.ocrResult

  const readyCount = items.filter(
    (it) => it.ocrResult?.date && it.ocrResult?.amount && it.ocrResult?.store_name
  ).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={onBack}>
          <ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} />
        </button>
        <h1 className="flex-1 font-bold" style={{ color: 'var(--text-primary)' }}>
          確認・修正 ({currentIndex + 1}/{items.length})
        </h1>
        <button
          onClick={onSave}
          disabled={saving || readyCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium disabled:opacity-40"
          style={{ background: '#7C5CBF', color: '#fff' }}
        >
          <Save size={15} />
          {saving ? '保存中...' : `${readyCount}件保存`}
        </button>
      </header>

      {/* サムネイル一覧 */}
      {items.length > 1 && (
        <div
          className="flex gap-2 px-4 py-2 overflow-x-auto"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => onIndexChange(i)}
              className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden relative"
              style={{ border: i === currentIndex ? '2px solid #7C5CBF' : '2px solid transparent' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
              {it.processing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}
              {it.ocrResult?.is_flagged && !it.processing && (
                <div className="absolute top-0.5 right-0.5">
                  <AlertCircle size={10} className="text-amber-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 画像プレビュー */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt="領収書"
            className="w-full max-h-48 object-contain"
            style={{ background: '#f0f0f0' }}
          />
        </div>

        {/* OCR結果編集 */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {item.processing ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              OCR処理中...
            </div>
          ) : item.error ? (
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-red-500">{item.error}</p>
              <button
                onClick={() => onRetryOcr(currentIndex)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <RotateCcw size={12} />
                再試行
              </button>
            </div>
          ) : ocr ? (
            <>
              {ocr.is_flagged && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: '#FEF3C7', color: '#92400E' }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">要確認</p>
                    {ocr.flag_reasons.map((r, i) => <p key={i}>{r}</p>)}
                  </div>
                </div>
              )}
              {!ocr.is_flagged && (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle size={14} />
                  <span>読み取り完了</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <OcrField label="日付" required={!ocr.date}>
                  <input
                    type="date"
                    value={ocr.date ?? ''}
                    onChange={(e) => onUpdateOcr(currentIndex, 'date', e.target.value || null)}
                    className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </OcrField>
                <OcrField label="金額（円）" required={!ocr.amount}>
                  <input
                    type="number"
                    value={ocr.amount ?? ''}
                    onChange={(e) => onUpdateOcr(currentIndex, 'amount', parseInt(e.target.value) || null)}
                    className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </OcrField>
                <OcrField label="店名" required={!ocr.store_name} className="col-span-2">
                  <input
                    type="text"
                    value={ocr.store_name ?? ''}
                    onChange={(e) => onUpdateOcr(currentIndex, 'store_name', e.target.value || null)}
                    className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </OcrField>
                <OcrField label="品名" className="col-span-2">
                  <input
                    type="text"
                    value={ocr.item_name ?? ''}
                    onChange={(e) => onUpdateOcr(currentIndex, 'item_name', e.target.value || null)}
                    className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </OcrField>
                <OcrField label="用途">
                  <select
                    value={item.purpose}
                    onChange={(e) => onUpdatePurpose(currentIndex, e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">未選択</option>
                    {purposes.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </OcrField>
                <OcrField label="支払方法">
                  <select
                    value={ocr.payment_method}
                    onChange={(e) => onUpdateOcr(currentIndex, 'payment_method', e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="cash">現金</option>
                    <option value="card">カード</option>
                  </select>
                </OcrField>
                {ocr.payment_method === 'card' && (
                  <OcrField label="カード情報" className="col-span-2">
                    <input
                      type="text"
                      value={ocr.card_info ?? ''}
                      onChange={(e) => onUpdateOcr(currentIndex, 'card_info', e.target.value || null)}
                      placeholder="例: JCB 1139"
                      className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                  </OcrField>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
              OCR待機中...
            </p>
          )}
        </div>

        {/* ナビゲーション */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRemove(currentIndex)}
            className="p-2 rounded-xl"
            style={{ background: '#FDE8E8', color: '#C62828' }}
          >
            <X size={16} />
          </button>
          <button
            disabled={currentIndex === 0}
            onClick={() => onIndexChange(currentIndex - 1)}
            className="flex-1 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            ← 前へ
          </button>
          <button
            disabled={currentIndex === items.length - 1}
            onClick={() => onIndexChange(currentIndex + 1)}
            className="flex-1 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            次へ →
          </button>
        </div>
      </div>
    </div>
  )
}

function OcrField({
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

// Base64変換
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // "data:image/jpeg;base64,..." の base64 部分だけ取り出す
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
