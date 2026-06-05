import { formatCurrency } from './format'

export interface ExportSaleItem {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface ExportSale {
  folio: string
  created_at: string
  total: number
  payment_method: string
  customer_name?: string | null
  items: ExportSaleItem[]
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
  other: 'Otro',
}

interface Opts {
  storeName: string
  currency?: string
  dateLabel: string
}

/** Filas detalladas: una por producto vendido (para PDF y Excel). */
function buildRows(sales: ExportSale[], currency: string) {
  const rows: Record<string, string | number>[] = []
  for (const s of sales) {
    const time = new Date(s.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    if (s.items.length === 0) {
      rows.push({
        Folio: s.folio, Hora: time, Producto: '—', Cantidad: '', 'Precio unit.': '',
        Importe: formatCurrency(s.total, currency), Pago: PAYMENT_LABELS[s.payment_method] ?? s.payment_method,
        Cliente: s.customer_name ?? '',
      })
    }
    s.items.forEach((it, idx) => {
      rows.push({
        Folio: idx === 0 ? s.folio : '',
        Hora: idx === 0 ? time : '',
        Producto: it.product_name,
        Cantidad: it.quantity,
        'Precio unit.': formatCurrency(it.unit_price, currency),
        Importe: formatCurrency(it.subtotal, currency),
        Pago: idx === 0 ? (PAYMENT_LABELS[s.payment_method] ?? s.payment_method) : '',
        Cliente: idx === 0 ? (s.customer_name ?? '') : '',
      })
    })
  }
  return rows
}

export async function exportSalesToExcel(sales: ExportSale[], opts: Opts) {
  const XLSX = await import('xlsx')
  const currency = opts.currency ?? 'MXN'
  const rows = buildRows(sales, currency)
  const total = sales.reduce((a, s) => a + Number(s.total), 0)
  rows.push({ Folio: '', Hora: '', Producto: '', Cantidad: '', 'Precio unit.': 'TOTAL', Importe: formatCurrency(total, currency), Pago: '', Cliente: '' })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 30 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
  XLSX.writeFile(wb, `ventas-${opts.dateLabel}.xlsx`)
}

export async function exportSalesToPDF(sales: ExportSale[], opts: Opts) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const currency = opts.currency ?? 'MXN'

  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(opts.storeName, 14, 18)
  doc.setFontSize(11)
  doc.setTextColor(120)
  doc.text(`Ventas del día · ${opts.dateLabel}`, 14, 25)

  const rows = buildRows(sales, currency)
  autoTable(doc, {
    startY: 31,
    head: [['Folio', 'Hora', 'Producto', 'Cant.', 'Precio', 'Importe', 'Pago', 'Cliente']],
    body: rows.map(r => [r.Folio, r.Hora, r.Producto, r.Cantidad, r['Precio unit.'], r.Importe, r.Pago, r.Cliente]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 2: { cellWidth: 45 } },
  })

  const total = sales.reduce((a, s) => a + Number(s.total), 0)
  const endY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40) + 8
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(`Total del día: ${formatCurrency(total, currency)}  ·  ${sales.length} ventas`, 14, endY)

  doc.save(`ventas-${opts.dateLabel}.pdf`)
}
