'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2, CalendarDays } from 'lucide-react'
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
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mercadopago: 'Pago online', other: 'Otro',
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada', cancelled: 'Cancelada', refunded: 'Reembolsada',
}

interface Props {
  sales: ExportSaleRow[]
  storeName: string
  isPaid?: boolean
}

export default function ExportSalesButtons({ sales, storeName }: Props) {
  const [loading, setLoading] = useState<'excel' | 'pdf' | null>(null)

  // Solo las ventas del día actual (hora local del usuario).
  const todayStr = new Date().toDateString()
  const today = sales.filter(s => new Date(s.created_at).toDateString() === todayStr)

  const rows = today.map(s => ({
    Folio: s.folio,
    Fecha: formatDateTime(s.created_at),
    Cliente: s.customer || 'Público general',
    Pago: PAYMENT_LABELS[s.payment_method] ?? s.payment_method,
    Total: s.total,
    Ganancia: s.profit,
    Estado: STATUS_LABELS[s.status] ?? s.status,
  }))
  const totalVentas = today.reduce((a, s) => a + Number(s.total), 0)
  const totalGanancia = today.reduce((a, s) => a + Number(s.profit), 0)
  const fileBase = `ventas-dia_${storeName.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}`

  async function exportExcel() {
    setLoading('excel')
    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.sheet_add_aoa(ws, [[], ['', '', '', 'TOTALES', totalVentas, totalGanancia, '']], { origin: -1 })
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 13 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas del día')
      XLSX.writeFile(wb, `${fileBase}.xlsx`)
    } finally { setLoading(null) }
  }

  async function exportPDF() {
    setLoading('pdf')
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      doc.setFontSize(16); doc.text(`Ventas del día — ${storeName}`, 14, 18)
      doc.setFontSize(10); doc.setTextColor(120)
      doc.text(`${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}  ·  ${today.length} ventas`, 14, 25)
      autoTable(doc, {
        startY: 30,
        head: [['Folio', 'Fecha', 'Cliente', 'Pago', 'Total', 'Ganancia', 'Estado']],
        body: rows.map(r => [r.Folio, r.Fecha, r.Cliente, r.Pago, formatCurrency(r.Total), formatCurrency(r.Ganancia), r.Estado]),
        foot: [['', '', '', 'TOTALES', formatCurrency(totalVentas), formatCurrency(totalGanancia), '']],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
      })
      doc.save(`${fileBase}.pdf`)
    } finally { setLoading(null) }
  }

  if (sales.length === 0) return null
  const none = today.length === 0

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400"><CalendarDays size={13} /> Hoy: {today.length}</span>
      <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading !== null || none} title={none ? 'Sin ventas hoy' : 'Ventas del día a Excel'}>
        {loading === 'excel' ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <FileSpreadsheet size={15} className="mr-1.5 text-green-600" />}
        Día · Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading !== null || none} title={none ? 'Sin ventas hoy' : 'Ventas del día a PDF'}>
        {loading === 'pdf' ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <FileText size={15} className="mr-1.5 text-red-600" />}
        Día · PDF
      </Button>
    </div>
  )
}
