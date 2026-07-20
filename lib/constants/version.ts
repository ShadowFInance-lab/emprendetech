/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.122'
export const APP_BUILD = '2026-07-20' // v7.122: STRIPE — el checkout ahora DEVUELVE el error REAL de Stripe/excepción al frontend y logs (antes tragaba todo en "Error creando el pago con Stripe"); lectura de cuenta/comisión aislada en su try (degrada a modo plataforma). Corregidos 2 catch{} vacíos en stripe.ts (POS + planes). GOOGLE — callback reescrito: adjunta las cookies de sesión a la respuesta de redirect (antes no persistía la sesión → rebotaba al inicio y pedía login otra vez); con sesión SIEMPRE va a /dashboard o /onboarding, nunca a la landing/login. /api/diag ahora crea una sesión de prueba real con ?stripe_test=1.
