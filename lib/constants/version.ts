/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.98'
export const APP_BUILD = '2026-07-02' // v7.98: Mercado Pago eliminado de TODA la UI — planes ahora se pagan con Stripe (createPlanCheckoutAction + activación por webhook), borrado MpBrick, textos landing/pricing/suscripción a Stripe, etiquetas históricas → "Pago online".
