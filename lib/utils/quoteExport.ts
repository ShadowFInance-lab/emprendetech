import { formatCurrency, formatDate } from './format'
import type { Quote } from '@/lib/actions/quotes'

export interface QuoteExportStore {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  logo_url?: string | null
  currency?: string
}

const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  expirada: 'Expirada',
  convertida: 'Convertida en venta',
}

/** Imagen → dataURL (para incrustar el logo en el PDF). Devuelve null si falla. */
async function toDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.width, h: img.height })
      img.onerror = () => resolve({ w: 1, h: 1 })
      img.src = data
    })
    return { data, ...dims }
  } catch {
    return null
  }
}

export async function exportQuoteToPDF(quote: Quote, store: QuoteExportStore) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const currency = store.currency ?? 'MXN'

  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const topY = 18

  // ─── Logo (opcional) ───────────────────────────────
  if (store.logo_url) {
    const logo = await toDataUrl(store.logo_url)
    if (logo) {
      const h = 18
      const w = Math.min(40, (logo.w / logo.h) * h)
      try { doc.addImage(logo.data, 'PNG', 14, 12, w, h) } catch { /* ignore */ }
    }
  }

  // ─── Encabezado de la tienda ───────────────────────
  doc.setFontSize(18)
  doc.setTextColor(17, 24, 39)
  doc.text(store.name, store.logo_url ? 58 : 14, topY)
  doc.setFontSize(9)
  doc.setTextColor(120)
  const contactLines = [store.phone, store.email, store.address].filter(Boolean) as string[]
  contactLines.forEach((line, i) => {
    doc.text(line, store.logo_url ? 58 : 14, topY + 6 + i * 4.5)
  })

  // ─── Título COTIZACIÓN + folio (a la derecha) ──────
  doc.setFontSize(22)
  doc.setTextColor(37, 99, 235)
  doc.text('COTIZACIÓN', pageW - 14, topY, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(`Folio: ${quote.folio}`, pageW - 14, topY + 7, { align: 'right' })
  doc.text(`Fecha: ${formatDate(quote.created_at)}`, pageW - 14, topY + 12, { align: 'right' })
  doc.text(`Estado: ${STATUS_LABEL[quote.status] ?? quote.status}`, pageW - 14, topY + 17, { align: 'right' })
  if (quote.valid_until) {
    doc.text(`Válida hasta: ${formatDate(quote.valid_until)}`, pageW - 14, topY + 22, { align: 'right' })
  }

  // ─── Cliente ────────────────────────────────────────
  let blockY = topY + 28 + contactLines.length * 4.5
  if (quote.customer_name) {
    doc.setDrawColor(229, 231, 235)
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(14, blockY, pageW - 28, 14, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text('CLIENTE', 18, blockY + 5)
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    doc.text(quote.customer_name, 18, blockY + 11)
    blockY += 20
  }

  // ─── Tabla de productos ─────────────────────────────
  autoTable(doc, {
    startY: blockY,
    head: [['Producto', 'Variante', 'Cant.', 'Precio unit.', 'Importe']],
    body: quote.items.map(i => [
      i.product_name,
      i.variant || '—',
      i.quantity,
      formatCurrency(i.unit_price, currency),
      formatCurrency(i.unit_price * i.quantity, currency),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], halign: 'left' },
    columnStyles: {
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
  })

  // ─── Totales ────────────────────────────────────────
  const endY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? blockY) + 8
  const labelX = pageW - 70
  const valueX = pageW - 14
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text('Subtotal:', labelX, endY)
  doc.text(formatCurrency(quote.subtotal, currency), valueX, endY, { align: 'right' })
  let ty = endY
  if (quote.discount_amt > 0) {
    ty += 6
    doc.setTextColor(220, 38, 38)
    doc.text('Descuento:', labelX, ty)
    doc.text(`- ${formatCurrency(quote.discount_amt, currency)}`, valueX, ty, { align: 'right' })
  }
  ty += 8
  doc.setFontSize(13)
  doc.setTextColor(17, 24, 39)
  doc.text('TOTAL:', labelX, ty)
  doc.text(formatCurrency(quote.total, currency), valueX, ty, { align: 'right' })

  // ─── Observaciones ──────────────────────────────────
  if (quote.notes) {
    ty += 14
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text('OBSERVACIONES', 14, ty)
    doc.setFontSize(9)
    doc.setTextColor(60)
    const wrapped = doc.splitTextToSize(quote.notes, pageW - 28)
    doc.text(wrapped, 14, ty + 5)
  }

  // ─── Pie ────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(160)
  doc.text(
    'Esta cotización no representa un comprobante fiscal. Precios sujetos a cambio sin previo aviso.',
    pageW / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  )

  doc.save(`cotizacion-${quote.folio}.pdf`)
}

export async function exportQuoteToExcel(quote: Quote, store: QuoteExportStore) {
  const XLSX = await import('xlsx')
  const currency = store.currency ?? 'MXN'

  const rows: Record<string, string | number>[] = quote.items.map(i => ({
    Producto: i.product_name,
    Variante: i.variant || '',
    Cantidad: i.quantity,
    'Precio unit.': formatCurrency(i.unit_price, currency),
    Importe: formatCurrency(i.unit_price * i.quantity, currency),
  }))
  rows.push({ Producto: '', Variante: '', Cantidad: '', 'Precio unit.': 'Subtotal', Importe: formatCurrency(quote.subtotal, currency) })
  if (quote.discount_amt > 0) {
    rows.push({ Producto: '', Variante: '', Cantidad: '', 'Precio unit.': 'Descuento', Importe: `- ${formatCurrency(quote.discount_amt, currency)}` })
  }
  rows.push({ Producto: '', Variante: '', Cantidad: '', 'Precio unit.': 'TOTAL', Importe: formatCurrency(quote.total, currency) })

  const header = [
    [store.name],
    [`Cotización ${quote.folio}`],
    [`Cliente: ${quote.customer_name ?? '—'}`],
    [`Fecha: ${formatDate(quote.created_at)}`],
    quote.valid_until ? [`Válida hasta: ${formatDate(quote.valid_until)}`] : [''],
    [''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(header)
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1 })
  ws['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 9 }, { wch: 14 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cotización')
  XLSX.writeFile(wb, `cotizacion-${quote.folio}.xlsx`)
}

/** Texto para compartir por WhatsApp / correo. */
export function buildQuoteText(quote: Quote, store: QuoteExportStore): string {
  const currency = store.currency ?? 'MXN'
  const lines: string[] = []
  lines.push(`*${store.name}* — Cotización ${quote.folio}`)
  if (quote.customer_name) lines.push(`Cliente: ${quote.customer_name}`)
  lines.push('')
  quote.items.forEach(i => {
    const v = i.variant ? ` (${i.variant})` : ''
    lines.push(`• ${i.quantity} × ${i.product_name}${v} — ${formatCurrency(i.unit_price * i.quantity, currency)}`)
  })
  lines.push('')
  if (quote.discount_amt > 0) lines.push(`Descuento: -${formatCurrency(quote.discount_amt, currency)}`)
  lines.push(`*TOTAL: ${formatCurrency(quote.total, currency)}*`)
  if (quote.valid_until) lines.push(`Válida hasta: ${formatDate(quote.valid_until)}`)
  if (quote.notes) { lines.push(''); lines.push(quote.notes) }
  return lines.join('\n')
}
