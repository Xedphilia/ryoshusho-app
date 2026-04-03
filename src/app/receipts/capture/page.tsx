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
  ZoomIn,
  Plus,
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
  const [saveError, setSaveError] = useState<string | null>(null)
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

  // 1枚OCR実行（Gemini Vision APIに画像を直接送信・複数領収書対応）
  async function runOcr(index: number, blob: Blob) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, processing: true, error: null } : item))
    )

    try {
      // 画像をbase64に変換してGemini Visionに直接送信
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

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
        if (json.multiple && Array.isArray(json.data)) {
          // 1枚の画像に複数の領収書が含まれていた場合、新しいアイテムとして展開
          const newItems: CaptureItem[] = json.data.map((ocrResult: OcrResult) => ({
            imageBlob: blob,
            imageUrl: URL.createObjectURL(blob),
            ocrResult,
            purpose: '',
            processing: false,
            error: null,
          }))
          // 元のアイテムを削除して展開したアイテムに置き換える
          setItems((prev) => {
            const next = [...prev]
            next.splice(index, 1, ...newItems)
            return next
          })
        } else {
          setItems((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, ocrResult: json.data as OcrResult, processing: false } : item
            )
          )
        }
      } else {
        setItems((prev) =>
          prev.map((item, i) =>
            i === index
              ? { ...item, error: json.error ?? 'OCRに失敗しました', processing: false }
              : item
          )
        )
      }
    } catch {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, error: 'OCRに失敗しました（ネットワークエラー）', processing: false }
            : item
        )
      )
    }
  }

  // バッチOCR実行（各枚をGemini Visionで並列処理）
  async function runBatchOcr(targetItems: CaptureItem[], startIndex: number) {
    // 対象を全部processing中にする
    setItems((prev) =>
      prev.map((item, i) =>
        i >= startIndex && i < startIndex + targetItems.length
          ? { ...item, processing: true, error: null }
          : item
      )
    )

    const storeNameList = storeNames.map((s) => s.name)

    // 各画像をGemini Visionで並列OCR（複数領収書対応）
    // 結果を一旦配列に収集してから一括でstateを更新する（並列splice競合防止）
    type OcrOutcome =
      | { kind: 'multiple'; blob: Blob; results: OcrResult[] }
      | { kind: 'single'; result: OcrResult }
      | { kind: 'error'; error: string }

    const outcomes: OcrOutcome[] = await Promise.all(
      targetItems.map(async (targetItem) => {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(targetItem.imageBlob)
          })

          const res = await fetch('/api/receipts/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_base64: base64,
              mime_type: targetItem.imageBlob.type || 'image/jpeg',
              store_names: storeNameList,
            }),
          })
          const json = await res.json()

          if (json.success) {
            if (json.multiple && Array.isArray(json.data)) {
              return { kind: 'multiple' as const, blob: targetItem.imageBlob, results: json.data as OcrResult[] }
            } else {
              return { kind: 'single' as const, result: json.data as OcrResult }
            }
          } else {
            return { kind: 'error' as const, error: json.error ?? 'OCRに失敗しました' }
          }
        } catch {
          return { kind: 'error' as const, error: 'OCRに失敗しました（ネットワークエラー）' }
        }
      })
    )

    // 全結果をまとめてstateに反映（indexのズレを防ぐため一括更新）
    setItems((prev) => {
      const next = [...prev]
      let offset = 0
      outcomes.forEach((outcome, i) => {
        const idx = startIndex + i + offset
        if (outcome.kind === 'multiple') {
          const newItems: CaptureItem[] = outcome.results.map((ocrResult) => ({
            imageBlob: outcome.blob,
            imageUrl: URL.createObjectURL(outcome.blob),
            ocrResult,
            purpose: '',
            processing: false,
            error: null,
          }))
          next.splice(idx, 1, ...newItems)
          offset += newItems.length - 1
        } else if (outcome.kind === 'single') {
          next[idx] = { ...next[idx], ocrResult: outcome.result, processing: false }
        } else {
          next[idx] = { ...next[idx], error: outcome.error, processing: false }
        }
      })
      return next
    })
  }

  // バッチ完了 → 確認画面へ（全枚まとめて1回のGeminiコール）
  function finishBatch() {
    if (items.length === 0) return
    stopCamera()
    setMode('confirm')
    setCurrentEditIndex(0)
    // 未OCRのものをまとめてバッチ処理（1回のGeminiコールで済む）
    const unprocessed = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.ocrResult && !item.processing)
    if (unprocessed.length === 0) return
    const startIndex = unprocessed[0].i
    runBatchOcr(unprocessed.map(({ item }) => item), startIndex)
  }

  // 保存
  async function saveAll() {
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    let successCount = 0
    const errors: string[] = []
    let firstSavedMonth: string | null = null
    for (const item of items) {
      if (!item.ocrResult?.date || !item.ocrResult?.amount || !item.ocrResult?.store_name) continue
      try {
        // Storage にアップロード
        const ext = 'jpg'
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('receipt-images')
          .upload(path, item.imageBlob, { contentType: 'image/jpeg' })

        if (uploadError) {
          errors.push(`画像アップロード失敗: ${uploadError.message}`)
          continue
        }

        const { data: urlData } = supabase.storage.from('receipt-images').getPublicUrl(path)
        const imageUrl = urlData.publicUrl

        // DB に保存
        const ocr = item.ocrResult
        const savedMonth = ocr.date!.slice(0, 7)
        const res = await fetch('/api/receipts', {
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
            month: savedMonth,
          }),
        })
        const json = await res.json()
        if (!json.success) {
          errors.push(`DB保存失敗: ${json.error}`)
          continue
        }
        if (!firstSavedMonth) firstSavedMonth = savedMonth
        successCount++
      } catch (e) {
        errors.push(`保存エラー: ${e instanceof Error ? e.message : '不明なエラー'}`)
      }
    }

    setSaving(false)
    if (errors.length > 0 && successCount === 0) {
      setSaveError(errors[0])
      return
    }
    // Object URLをクリーンアップ
    items.forEach((item) => URL.revokeObjectURL(item.imageUrl))
    router.push(`/receipts${firstSavedMonth ? `?month=${firstSavedMonth}` : ''}`)
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
          saveError={saveError}
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
          onAddPurpose={async (name) => {
            await fetch('/api/purposes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            })
            const res = await fetch('/api/purposes')
            const json = await res.json()
            if (json.success) setPurposes(json.data)
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
  saveError: string | null
  onIndexChange: (i: number) => void
  onUpdateOcr: (i: number, field: string, value: unknown) => void
  onUpdatePurpose: (i: number, value: string) => void
  onRetryOcr: (i: number) => void
  onRemove: (i: number) => void
  onAddPurpose: (name: string) => Promise<void>
  onSave: () => void
  onBack: () => void
}

function ConfirmScreen({
  items, currentIndex, purposes, saving, saveError,
  onIndexChange, onUpdateOcr, onUpdatePurpose, onRetryOcr, onRemove, onAddPurpose, onSave, onBack,
}: ConfirmScreenProps) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)
  const [zoomScale, setZoomScale] = useState(1.5)
  const [purposeInputMode, setPurposeInputMode] = useState<'dropdown' | 'free'>('dropdown')

  const item = items[currentIndex]
  const ocr = item?.ocrResult

  const readyCount = items.filter(
    (it) => it.ocrResult?.date && it.ocrResult?.amount && it.ocrResult?.store_name
  ).length

  return (
    <>
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
        {/* 保存エラー表示 */}
        {saveError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600" style={{ background: '#FDE8E8' }}>
            <AlertCircle size={14} />
            {saveError}
          </div>
        )}

        {/* 画像プレビュー */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ border: '1px solid var(--border)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt="領収書"
            className="w-full object-contain"
            style={{ background: '#f0f0f0', maxHeight: '320px' }}
          />
          <button
            onClick={() => { setZoomIndex(currentIndex); setZoomScale(1.5) }}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 text-white"
            title="拡大表示"
          >
            <ZoomIn size={16} />
          </button>
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
                  <ItemNameList
                    value={ocr.item_name ?? ''}
                    onChange={(v) => onUpdateOcr(currentIndex, 'item_name', v || null)}
                  />
                </OcrField>
                <OcrField label="用途">
                  <div className="flex gap-1 mb-1">
                    {(['dropdown', 'free'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPurposeInputMode(m)}
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: purposeInputMode === m ? '#7C5CBF' : 'var(--bg-primary)',
                          color: purposeInputMode === m ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${purposeInputMode === m ? '#7C5CBF' : 'var(--border)'}`,
                        }}
                      >
                        {m === 'dropdown' ? 'プルダウン' : '自由入力'}
                      </button>
                    ))}
                  </div>
                  {purposeInputMode === 'dropdown' ? (
                    <select
                      value={item.purpose}
                      onChange={(e) => onUpdatePurpose(currentIndex, e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">未選択</option>
                      {purposes.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  ) : (
                    <PurposeCombobox
                      value={item.purpose}
                      purposes={purposes}
                      onChange={(v) => onUpdatePurpose(currentIndex, v)}
                      onAddPurpose={onAddPurpose}
                    />
                  )}
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

    {/* ── ズームモーダル ───────────────────────── */}
    {zoomIndex !== null && (() => {
      const zItem = items[zoomIndex]
      const zOcr = zItem?.ocrResult
      const pct = `${Math.round(zoomScale * 100)}%`
      return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(0,0,0,0.85)' }}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomScale((s) => Math.max(0.5, parseFloat((s - 0.25).toFixed(2))))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >−</button>
              <span className="text-white text-sm w-14 text-center">{pct}</span>
              <button
                onClick={() => setZoomScale((s) => Math.min(5, parseFloat((s + 0.25).toFixed(2))))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >+</button>
            </div>
            <span className="text-white/50 text-xs">タップで閉じる: ×</span>
            <button
              className="p-2 rounded-full text-white"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              onClick={() => setZoomIndex(null)}
            >
              <X size={18} />
            </button>
          </div>

          {/* 画像エリア（スクロール可能） */}
          <div className="overflow-auto" style={{ flex: '0 0 52vh', background: '#111' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zItem.imageUrl}
              alt="領収書拡大"
              style={{ width: `${zoomScale * 100}%`, display: 'block' }}
            />
          </div>

          {/* 編集可能OCRパネル */}
          <div className="overflow-auto px-4 py-3 space-y-2" style={{ flex: 1, background: '#1a1a2e' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              OCR結果 — 直接編集できます
            </p>
            {zOcr ? (
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: '日付', field: 'date', type: 'date', span: 1 },
                  { label: '金額（円）', field: 'amount', type: 'number', span: 1 },
                  { label: '店名', field: 'store_name', type: 'text', span: 2 },
                ] as const).map(({ label, field, type, span }) => (
                  <div key={field} className={span === 2 ? 'col-span-2' : ''}>
                    <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                    <input
                      type={type}
                      value={field === 'amount'
                        ? (zOcr.amount ?? '')
                        : (zOcr[field as 'date' | 'store_name'] ?? '')}
                      onChange={(e) => {
                        const val = field === 'amount'
                          ? (parseInt(e.target.value) || null)
                          : (e.target.value || null)
                        onUpdateOcr(zoomIndex, field, val)
                      }}
                      className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>品名</p>
                  <ItemNameList
                    value={zOcr.item_name ?? ''}
                    onChange={(v) => onUpdateOcr(zoomIndex, 'item_name', v || null)}
                    dark
                  />
                </div>
                {zOcr.is_flagged && (
                  <div className="col-span-2 flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: '#7C3317' }}>
                    <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">{zOcr.flag_reasons.join(' / ')}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>OCR処理中...</p>
            )}
          </div>
        </div>
      )
    })()}
    </>
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

// ── 用途コンボボックス ──────────────────────────────────
function PurposeCombobox({
  value, purposes, onChange, onAddPurpose,
}: {
  value: string
  purposes: Purpose[]
  onChange: (v: string) => void
  onAddPurpose: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = purposes.filter((p) =>
    p.name.toLowerCase().includes(value.toLowerCase())
  )
  const showAdd = value.trim() && !purposes.some((p) => p.name === value.trim())

  async function handleAdd() {
    if (!value.trim()) return
    setAdding(true)
    await onAddPurpose(value.trim())
    setAdding(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="未選択 または 入力"
        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div
          className="absolute z-20 left-0 right-0 rounded-lg overflow-hidden shadow-lg"
          style={{ top: '100%', marginTop: 2, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => { onChange(p.name); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
              style={{ color: 'var(--text-primary)' }}
            >
              {p.name}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onMouseDown={handleAdd}
              disabled={adding}
              className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-1.5"
              style={{ color: '#7C5CBF', borderTop: '1px solid var(--border)' }}
            >
              <Plus size={13} />
              {adding ? '追加中...' : `「${value.trim()}」を追加`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── 品名リスト編集 ──────────────────────────────────────
function ItemNameList({ value, onChange, dark = false }: { value: string; onChange: (v: string) => void; dark?: boolean }) {
  // 末尾の空欄を維持するための内部state
  const [localItems, setLocalItems] = useState<string[]>(() => {
    const parsed = value ? value.split(',').map((s) => s.trim()) : []
    return parsed.length > 0 ? parsed : ['']
  })

  useEffect(() => {
    const parsed = value ? value.split(',').map((s) => s.trim()) : ['']
    setLocalItems(parsed.length > 0 ? parsed : [''])
  }, [value])

  function handleChange(index: number, val: string) {
    const next = [...localItems]
    next[index] = val
    setLocalItems(next)
    onChange(next.filter(Boolean).join(', '))
  }

  function handleRemove(index: number) {
    const next = localItems.filter((_, i) => i !== index)
    const result = next.length > 0 ? next : ['']
    setLocalItems(result)
    onChange(result.filter(Boolean).join(', '))
  }

  function handleAdd() {
    setLocalItems((prev) => [...prev, ''])
  }

  return (
    <div className="space-y-1">
      {localItems.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            value={item}
            onChange={(e) => handleChange(i, e.target.value)}
            placeholder={`品名 ${i + 1}`}
            className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
            style={dark
              ? { background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
              : { border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
          {localItems.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="p-1 rounded-lg flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
        style={{ color: '#7C5CBF', border: '1px dashed #7C5CBF' }}
      >
        <Plus size={12} />
        品名を追加
      </button>
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
