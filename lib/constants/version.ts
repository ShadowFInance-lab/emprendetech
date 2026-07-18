/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.114'
export const APP_BUILD = '2026-07-13' // v7.114: OAuth Google — código verificado end-to-end (PKCE cookies + error visible en /login + logs del proveedor en callback; falta solo allowlist en Supabase); migración 052 en archivo propio; Ventas Online abre en "Pagado" (listos para enviar); checkout sin Transferencia (Contra entrega + Tarjeta).
