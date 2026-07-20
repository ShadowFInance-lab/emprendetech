/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.119'
export const APP_BUILD = '2026-07-13' // v7.119: "Pago con Stripe" (renombrado) + FIX de cobro real: sin cuenta Stripe conectada la sesión se crea igual con cobro directo a la plataforma (antes devolvía null y el pedido quedaba pendiente sin cobrar); con cuenta conectada, destination charge + comisión como siempre.
