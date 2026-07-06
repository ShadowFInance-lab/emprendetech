/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.92'
export const APP_BUILD = '2026-07-02' // v7.92: webhook Stripe completo — maneja async_payment_succeeded (OXXO/diferidos) + revalida /sales, /dashboard e /inventory al registrar. customer_creation if_required ya existía (v7.87); documentado que la tarjeta NO se guarda (sin setup_future_usage). (Pediste "v7.91" pero ya existía; va como v7.92.)
