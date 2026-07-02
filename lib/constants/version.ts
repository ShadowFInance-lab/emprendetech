/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.88'
export const APP_BUILD = '2026-07-02' // v7.88: Webhook /api/stripe/webhook — registra la venta (con items → descuenta stock) al completarse el pago. Firma verificada, idempotente por session id (migr. 048). (Pediste "v7.84" pero ya existía; va como v7.88.)
