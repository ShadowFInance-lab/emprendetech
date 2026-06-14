import { MercadoPagoConfig, Preference } from 'mercadopago'

/**
 * Cliente de Mercado Pago.
 * Retorna null si no está configurado (permite que la app funcione sin MP en dev).
 */
export function getMercadoPagoClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken || accessToken === 'YOUR_MP_ACCESS_TOKEN') {
    return null
  }
  return new MercadoPagoConfig({ accessToken })
}

export function isMercadoPagoConfigured(): boolean {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  return !!token && token !== 'YOUR_MP_ACCESS_TOKEN'
}

/**
 * Cliente de MP para un token específico (cuenta de la tienda para ventas).
 * Si no se pasa token, usa el de la plataforma (env). Null si no hay ninguno.
 */
export function getMercadoPagoClientFor(token?: string | null) {
  const accessToken = token || process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken || accessToken === 'YOUR_MP_ACCESS_TOKEN') return null
  return new MercadoPagoConfig({ accessToken })
}

export { Preference }
