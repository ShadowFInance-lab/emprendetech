/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.90'
export const APP_BUILD = '2026-07-02' // v7.90: un solo generador Stripe en /sales/new — queda el widget "Cobro rápido con Stripe" arriba; quitado el botón morado del carrito (Tarjeta vuelve al Cobrar verde). Webhook solo auto-registra checkouts con items (sin duplicados).
