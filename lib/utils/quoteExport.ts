import { formatCurrency, formatDate } from './format'

// Tipo estructural (sirve tanto para Quote completo como para la versión pública sin costo)
export interface ExportItem {
  product_name: string
  variant?: string
  quantity: number
  unit_price: number
  discount_value?: number
  discount_pct?: boolean
  note?: string
}
export interface ExportQuote {
  folio: string
  status: string
  created_at: string
  valid_until: string | null
  customer_name: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  customer_rfc?: string | null
  items: ExportItem[]
  subtotal: number
  discount_amt: number
  total: number
  notes: string | null
  payment_method?: string | null
  deposit_pct?: number | null
  delivery_time?: string | null
  signature?: string | null
}

export interface QuoteExportStore {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  logo_url?: string | null
  currency?: string
}

const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada',
  rechazada: 'Rechazada', expirada: 'Vencida', convertida: 'Convertida en venta',
}
const PAY_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mercadopago: 'Mercado Pago',
}

function lineGross(i: ExportItem) { return i.unit_price * i.quantity }
function lineDiscountAmt(i: ExportItem) {
  const v = i.discount_value ?? 0
  if (v <= 0) return 0
  const d = i.discount_pct ? lineGross(i) * (v / 100) : v
  return Math.min(Math.max(0, d), lineGross(i))
}
function lineTotal(i: ExportItem) { return lineGross(i) - lineDiscountAmt(i) }
function discountLabel(i: ExportItem, currency: string) {
  if (!i.discount_value || i.discount_value <= 0) return '—'
  return i.discount_pct ? `${i.discount_value}%` : formatCurrency(i.discount_value, currency)
}

/** Imagen → dataURL (para incrustar el logo en el PDF). */
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

type JsPDF = import('jspdf').jsPDF

async function buildQuotePDF(quote: ExportQuote, store: QuoteExportStore, publicUrl?: string): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const currency = store.currency ?? 'MXN'

  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const topY = 18

  // Logo
  if (store.logo_url) {
    const logo = await toDataUrl(store.logo_url)
    if (logo) {
      const h = 18
      const w = Math.min(40, (logo.w / logo.h) * h)
      try { doc.addImage(logo.data, 'PNG', 14, 12, w, h) } catch { /* ignore */ }
    }
  }

  // Encabezado tienda
  const headX = store.logo_url ? 58 : 14
  doc.setFontSize(18); doc.setTextColor(17, 24, 39)
  doc.text(store.name, headX, topY)
  doc.setFontSize(9); doc.setTextColor(120)
  const contact = [store.phone, store.email, store.address].filter(Boolean) as string[]
  contact.forEach((line, i) => doc.text(line, headX, topY + 6 + i * 4.5))

  // Título + folio
  doc.setFontSize(22); doc.setTextColor(37, 99, 235)
  doc.text('COTIZACIÓN', pageW - 14, topY, { align: 'right' })
  doc.setFontSize(10); doc.setTextColor(80)
  doc.text(`Folio: ${quote.folio}`, pageW - 14, topY + 7, { align: 'right' })
  doc.text(`Fecha: ${formatDate(quote.created_at)}`, pageW - 14, topY + 12, { align: 'right' })
  doc.text(`Estado: ${STATUS_LABEL[quote.status] ?? quote.status}`, pageW - 14, topY + 17, { align: 'right' })
  if (quote.valid_until) doc.text(`Válida hasta: ${formatDate(quote.valid_until)}`, pageW - 14, topY + 22, { align: 'right' })

  // Cliente
  let blockY = topY + 28 + contact.length * 4.5
  const clientLines = [
    quote.customer_name ? `Nombre: ${quote.customer_name}` : null,
    quote.customer_email ? `Correo: ${quote.customer_email}` : null,
    quote.customer_phone ? `Tel: ${quote.customer_phone}` : null,
    quote.customer_address ? `Dirección: ${quote.customer_address}` : null,
    quote.customer_rfc ? `RFC: ${quote.customer_rfc}` : null,
  ].filter(Boolean) as string[]
  if (clientLines.length) {
    const boxH = 8 + clientLines.length * 5
    doc.setDrawColor(229, 231, 235); doc.setFillColor(249, 250, 251)
    doc.roundedRect(14, blockY, pageW - 28, boxH, 2, 2, 'FD')
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text('CLIENTE', 18, blockY + 5)
    doc.setFontSize(10); doc.setTextColor(40)
    clientLines.forEach((l, i) => doc.text(l, 18, blockY + 11 + i * 5))
    blockY += boxH + 6
  }

  // Tabla de productos
  autoTable(doc, {
    startY: blockY,
    head: [['Producto', 'Cant.', 'Precio unit.', 'Descuento', 'Total']],
    body: quote.items.map(i => [
      i.product_name + (i.variant ? `\n${i.variant}` : '') + (i.note ? `\nNota: ${i.note}` : ''),
      i.quantity,
      formatCurrency(i.unit_price, currency),
      discountLabel(i, currency),
      formatCurrency(lineTotal(i), currency),
    ]),
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
    headStyles: { fillColor: [37, 99, 235], halign: 'left' },
    columnStyles: {
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 30 },
    },
  })

  // Totales
  let endY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? blockY) + 8
  const labelX = pageW - 70, valueX = pageW - 14
  doc.setFontSize(10); doc.setTextColor(80)
  doc.text('Subtotal:', labelX, endY)
  doc.text(formatCurrency(quote.subtotal, currency), valueX, endY, { align: 'right' })
  if (quote.discount_amt > 0) {
    endY += 6; doc.setTextColor(220, 38, 38)
    doc.text('Descuento:', labelX, endY)
    doc.text(`- ${formatCurrency(quote.discount_amt, currency)}`, valueX, endY, { align: 'right' })
  }
  endY += 8
  doc.setFontSize(13); doc.setTextColor(17, 24, 39)
  doc.text('TOTAL:', labelX, endY)
  doc.text(formatCurrency(quote.total, currency), valueX, endY, { align: 'right' })
  if (quote.deposit_pct && quote.deposit_pct > 0) {
    endY += 7; doc.setFontSize(9); doc.setTextColor(120)
    const dep = quote.total * (quote.deposit_pct / 100)
    doc.text(`Anticipo (${quote.deposit_pct}%): ${formatCurrency(dep, currency)}`, valueX, endY, { align: 'right' })
  }

  // Condiciones de cierre (izquierda)
  let infoY = endY - (quote.deposit_pct ? 21 : 16)
  const cond: string[] = []
  if (quote.payment_method) cond.push(`Pago: ${PAY_LABEL[quote.payment_method] ?? quote.payment_method}`)
  if (quote.delivery_time) cond.push(`Entrega: ${quote.delivery_time}`)
  if (cond.length) {
    doc.setFontSize(9); doc.setTextColor(90)
    cond.forEach(c => { doc.text(c, 14, infoY); infoY += 5 })
  }

  // Observaciones
  if (quote.notes) {
    const ny = Math.max(endY + 12, infoY + 4)
    doc.setFontSize(8); doc.setTextColor(120); doc.text('OBSERVACIONES', 14, ny)
    doc.setFontSize(9); doc.setTextColor(60)
    doc.text(doc.splitTextToSize(quote.notes, pageW - 28), 14, ny + 5)
  }

  // QR del enlace público + firma (parte baja)
  const bottomY = doc.internal.pageSize.getHeight() - 50
  if (publicUrl) {
    try {
      const QRCode = await import('qrcode')
      const qr = await QRCode.toDataURL(publicUrl, { margin: 1, width: 220 })
      doc.addImage(qr, 'PNG', 14, bottomY, 26, 26)
      doc.setFontSize(7); doc.setTextColor(120)
      doc.text('Escanea para', 44, bottomY + 10)
      doc.text('aprobar/rechazar', 44, bottomY + 14)
    } catch { /* QR opcional */ }
  }
  if (quote.signature) {
    try {
      doc.addImage(quote.signature, 'PNG', pageW - 70, bottomY - 4, 56, 24)
      doc.setDrawColor(200); doc.line(pageW - 70, bottomY + 22, pageW - 14, bottomY + 22)
      doc.setFontSize(8); doc.setTextColor(120)
      doc.text('Firma del cliente', pageW - 42, bottomY + 27, { align: 'center' })
    } catch { /* firma opcional */ }
  }

  // Pie — la TIENDA es la emisora responsable; Mercanta solo como mención chica.
  const footY = doc.internal.pageSize.getHeight()
  doc.setFontSize(8); doc.setTextColor(110)
  doc.text(`Cotización emitida por ${store.name}`, pageW / 2, footY - 16, { align: 'center' })
  doc.setFontSize(7.5); doc.setTextColor(150)
  doc.text(
    'Esta cotización no representa un comprobante fiscal. Precios sujetos a cambio sin previo aviso.',
    pageW / 2, footY - 11, { align: 'center' }
  )
  doc.setFontSize(7); doc.setTextColor(190)
  doc.text('Generada con Mercanta Business', pageW / 2, footY - 6.5, { align: 'center' })
  return doc
}

export async function exportQuoteToPDF(quote: ExportQuote, store: QuoteExportStore, publicUrl?: string) {
  const doc = await buildQuotePDF(quote, store, publicUrl)
  doc.save(`cotizacion-${quote.folio}.pdf`)
}

export async function printQuote(quote: ExportQuote, store: QuoteExportStore, publicUrl?: string) {
  const doc = await buildQuotePDF(quote, store, publicUrl)
  doc.autoPrint()
  const url = doc.output('bloburl')
  window.open(url, '_blank')
}

export async function exportQuoteToExcel(quote: ExportQuote, store: QuoteExportStore) {
  const XLSX = await import('xlsx')
  const currency = store.currency ?? 'MXN'

  const rows: Record<string, string | number>[] = quote.items.map(i => ({
    Producto: i.product_name + (i.variant ? ` (${i.variant})` : ''),
    Nota: i.note ?? '',
    Cantidad: i.quantity,
    'Precio unit.': formatCurrency(i.unit_price, currency),
    Descuento: discountLabel(i, currency),
    Total: formatCurrency(lineTotal(i), currency),
  }))
  rows.push({ Producto: '', Nota: '', Cantidad: '', 'Precio unit.': '', Descuento: 'Subtotal', Total: formatCurrency(quote.subtotal, currency) })
  if (quote.discount_amt > 0) rows.push({ Producto: '', Nota: '', Cantidad: '', 'Precio unit.': '', Descuento: 'Descuento', Total: `- ${formatCurrency(quote.discount_amt, currency)}` })
  rows.push({ Producto: '', Nota: '', Cantidad: '', 'Precio unit.': '', Descuento: 'TOTAL', Total: formatCurrency(quote.total, currency) })

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
  ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cotización')
  XLSX.writeFile(wb, `cotizacion-${quote.folio}.xlsx`)
}

/** Texto para WhatsApp / correo. */
export function buildQuoteText(quote: ExportQuote, store: QuoteExportStore, publicUrl?: string): string {
  const currency = store.currency ?? 'MXN'
  const lines: string[] = []
  lines.push(`*${store.name}* — Cotización ${quote.folio}`)
  if (quote.customer_name) lines.push(`Cliente: ${quote.customer_name}`)
  lines.push('')
  quote.items.forEach(i => {
    const v = i.variant ? ` (${i.variant})` : ''
    lines.push(`• ${i.quantity} × ${i.product_name}${v} — ${formatCurrency(lineTotal(i), currency)}`)
  })
  lines.push('')
  if (quote.discount_amt > 0) lines.push(`Descuento: -${formatCurrency(quote.discount_amt, currency)}`)
  lines.push(`*TOTAL: ${formatCurrency(quote.total, currency)}*`)
  if (quote.deposit_pct && quote.deposit_pct > 0) {
    lines.push(`Anticipo (${quote.deposit_pct}%): ${formatCurrency(quote.total * (quote.deposit_pct / 100), currency)}`)
  }
  if (quote.payment_method) lines.push(`Pago: ${PAY_LABEL[quote.payment_method] ?? quote.payment_method}`)
  if (quote.delivery_time) lines.push(`Entrega: ${quote.delivery_time}`)
  if (quote.valid_until) lines.push(`Válida hasta: ${formatDate(quote.valid_until)}`)
  if (quote.notes) { lines.push(''); lines.push(quote.notes) }
  if (publicUrl) { lines.push(''); lines.push(`Aprobar o rechazar: ${publicUrl}`) }
  return lines.join('\n')
}
