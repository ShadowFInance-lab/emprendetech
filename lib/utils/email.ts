// Envío de correos transaccionales con Resend (opcional). Módulo SOLO servidor
// (usa la API key). Si no hay RESEND_API_KEY configurada NO falla: registra y
// omite — el flujo (marcar enviado) nunca depende del correo; el WhatsApp
// listo-para-copiar es el respaldo que siempre funciona.

interface SendResult { ok: boolean; skipped?: boolean; error?: string }

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  // Remitente: debe ser un dominio verificado en Resend. Configúralo en
  // RESEND_FROM (ej: "Mercanta Business <pedidos@tudominio.com>").
  const from = process.env.RESEND_FROM?.trim() || 'Mercanta Business <onboarding@resend.dev>'
  if (!key) {
    console.warn('[email] RESEND_API_KEY no configurada; correo omitido (no crítico).')
    return { ok: false, skipped: true }
  }
  if (!to || !to.includes('@')) return { ok: false, skipped: true }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error('[email] Resend rechazó el envío:', res.status, txt.slice(0, 300))
      return { ok: false, error: `HTTP ${res.status}` }
    }
    console.log('[email] ✅ correo enviado a', to)
    return { ok: true }
  } catch (e) {
    console.error('[email] excepción enviando correo:', e instanceof Error ? e.message : e)
    return { ok: false, error: 'network' }
  }
}
