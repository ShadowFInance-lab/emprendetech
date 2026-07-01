/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.77'
export const APP_BUILD = '2026-06-30' // v7.77: Stripe Connect (OAuth) — botón "Conectar cuenta de Stripe" (/api/oauth/stripe/*), se guarda account_id (acct_) y los cobros son destination charges con STRIPE_SECRET_KEY (plataforma). Sin claves manuales.
