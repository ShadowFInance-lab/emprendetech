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

export { Preference }
