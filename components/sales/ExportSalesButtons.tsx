'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

export interface ExportSaleRow {
  folio: string
  created_at: string
  customer: string
  payment_method: string
  total: number
  profit: number
  status: string
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro',
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada', cancelled: 'Cancelada', refunded: 'Reembolsada',
}

interface Props {
  sales: ExportSaleRow[]
  storeName: string
}

export default function ExportSalesButtons({ sales, storeName }: Props) {
  const [loading, setLoading] = useState<'excel' | 'pdf' | null>(null)

  const rows = sales.map(s => ({
    Folio: s.folio,
    Fecha: formatDateTime(s.created_at),
    Cliente: s.customer || 'Público general',
    Pago: PAYMENT_LABELS[s.payment_method] ?? s.payment_method,
    Total: s.total,
    Ganancia: s.profit,
    Estado: STATUS_LABELS[s.status] ?? s.status,
  }))

  const totalVentas = sales.reduce((a, s) => a + Number(s.total), 0)
  const totalGanancia = sales.reduce((a, s) => a + Number(s.profit), 0)

  // ─── EXCEL ──────────────────────────────────────────────────
  async function exportExcel() {
    setLoading('excel')
    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      // Fila de totales
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['', '', '', 'TOTALES', totalVentas, totalGanancia, ''],
      ], { origin: -1 })
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 13 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
      XLSX.writeFile(wb, `ventas_${storeName.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setLoading(null)
    }
  }

  // ─── PDF ────────────────────────────────────────────────────
  async function exportPDF() {
    setLoading('pdf')
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text(`Reporte de Ventas — ${storeName}`, 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}  ·  ${sales.length} ventas`, 14, 25)

      autoTable(doc, {
        startY: 30,
        head: [['Folio', 'Fecha', 'Cliente', 'Pago', 'Total', 'Ganancia', 'Estado']],
        body: rows.map(r => [
          r.Folio, r.Fecha, r.Cliente, r.Pago,
          formatCurrency(r.Total), formatCurrency(r.Ganancia), r.Estado,
        ]),
        foot: [['', '', '', 'TOTALES', formatCurrency(totalVentas), formatCurrency(totalGanancia), '']],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
      })

      doc.save(`ventas_${storeName.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setLoading(null)
    }
  }

  if (sales.length === 0) return null

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading !== null}>
        {loading === 'excel'
          ? <Loader2 size={15} className="mr-1.5 animate-spin" />
          : <FileSpreadsheet size={15} className="mr-1.5 text-green-600" />}
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading !== null}>
        {loading === 'pdf'
          ? <Loader2 size={15} className="mr-1.5 animate-spin" />
          : <FileText size={15} className="mr-1.5 text-red-600" />}
        PDF
      </Button>
    </div>
  )
}
