/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.94'
export const APP_BUILD = '2026-07-02' // v7.94: Checkout mínimo — solo tarjeta (payment_method_types=card: sin Link "guarda tus datos", sin vales) + locale es-419. Ya sin cuenta ni dirección extra (if_required/auto). Correo obligatorio por Stripe (recibo).
