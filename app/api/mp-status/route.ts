import { NextResponse } from 'next/server'
import { isMercadoPagoConfigured } from '@/lib/mercadopago/client'

/**
 * Diagnóstico de configuración de Mercado Pago.
 * Abre /api/mp-status para verificar si Vercel está leyendo las variables.
 * NO expone el secreto — solo devuelve booleanos + la URL pública configurada.
 */
export async function GET() {
  return NextResponse.json({
    mercadopago_access_token_presente: isMercadoPagoConfigured(),
    public_key_presente: !!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY,
    app_url_configurada: process.env.NEXT_PUBLIC_APP_URL ?? '(no configurada)',
    nota: 'Si access_token o public_key salen en false, agrégalas en Vercel → Environment Variables (scope Production) y haz REDEPLOY.',
  })
}
