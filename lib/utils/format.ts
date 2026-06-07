// ─── Formato de moneda (MXN por defecto, configurable) ───────
// locale por moneda para que el símbolo salga correcto
const CURRENCY_LOCALE: Record<string, string> = {
  MXN: 'es-MX', USD: 'en-US', EUR: 'es-ES', COP: 'es-CO',
  ARS: 'es-AR', CLP: 'es-CL', PEN: 'es-PE', GTQ: 'es-GT',
  BRL: 'pt-BR', GBP: 'en-GB', JPY: 'ja-JP', CAD: 'en-CA', CNY: 'zh-CN',
}

export function formatCurrency(amount: number, currency = 'MXN'): string {
  const code = (currency || 'MXN').toUpperCase()
  return new Intl.NumberFormat(CURRENCY_LOCALE[code] ?? 'es-MX', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
  }).format(amount)
}

export const SUPPORTED_CURRENCIES = [
  { code: 'MXN', label: 'Peso mexicano (MXN)' },
  { code: 'USD', label: 'Dólar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'COP', label: 'Peso colombiano (COP)' },
  { code: 'ARS', label: 'Peso argentino (ARS)' },
  { code: 'CLP', label: 'Peso chileno (CLP)' },
  { code: 'PEN', label: 'Sol peruano (PEN)' },
  { code: 'GTQ', label: 'Quetzal (GTQ)' },
  { code: 'BRL', label: 'Real (BRL)' },
  { code: 'GBP', label: 'Libra (GBP)' },
  { code: 'JPY', label: 'Yen (JPY)' },
  { code: 'CAD', label: 'Dólar canadiense (CAD)' },
  { code: 'CNY', label: 'Yuan (CNY)' },
]

// ─── Formato de fecha ────────────────────────────────────────
export function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(new Date(dateStr))
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

// ─── Formato de porcentaje ───────────────────────────────────
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

// ─── Truncar texto ───────────────────────────────────────────
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}
