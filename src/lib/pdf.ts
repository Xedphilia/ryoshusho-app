import type { Receipt } from '@/lib/supabase/types'

export function generatePdf(receipts: Receipt[], month: string) {
  // jspdfは動的importでESM互換にする（SSR不可のため）
  import('jspdf').then((mod) => {
    const jsPDF = mod.default ?? (mod as unknown as { jsPDF: typeof mod.default }).jsPDF
    import('jspdf-autotable').then(() => {
      const doc = new jsPDF({ orientation: 'landscape' })

      const label = month
        ? `${month.slice(0, 4)}年${parseInt(month.slice(5, 7))}月 領収書一覧`
        : '領収書一覧'

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(label, 14, 16)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      const total = receipts.reduce((s, r) => s + r.amount, 0)
      doc.text(`合計: ¥${total.toLocaleString('ja-JP')}  (${receipts.length}件)`, 14, 23)

      const rows = receipts.map((r) => [
        r.date,
        `¥${r.amount.toLocaleString('ja-JP')}`,
        r.store_name,
        r.item_name ?? '',
        r.purpose ?? '',
        r.payment_method === 'card'
          ? r.card_info ? `Card(${r.card_info})` : 'Card'
          : 'Cash',
        r.image_url,
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(doc as any).autoTable({
        head: [['日付', '金額', '店名', '品名', '用途', '支払', '画像URL']],
        body: rows,
        startY: 28,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 'auto' },
        },
        headStyles: { fillColor: [124, 92, 191] },
      })

      doc.save(`receipts_${month || 'all'}.pdf`)
    })
  })
}
