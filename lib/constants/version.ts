/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.93'
export const APP_BUILD = '2026-07-02' // v7.93: quitada la notificación "Stripe Checkout abierto…" del POS; webhook con idempotencia de respaldo (nota lleva el session id — sin duplicados aunque falte la migración 048). customer_creation if_required confirmado; sin setup_future_usage (no se guarda tarjeta).
