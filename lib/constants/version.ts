/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.103'
export const APP_BUILD = '2026-07-02' // v7.103: trial blindado — no se re-otorga con correos ya registrados (check de identities anti-enumeración) ni a perfiles que no estén en free; gancho "🎁 5 días gratis" en el registro. Comisiones 3/0/2 verificadas (stripe.ts:91-94,130).
