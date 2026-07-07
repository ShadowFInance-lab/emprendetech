/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.95'
export const APP_BUILD = '2026-07-02' // v7.95: sin cambios funcionales — el checkout mínimo pedido ya estaba vigente (v7.87: customer_creation if_required + billing_address auto; v7.94: solo tarjeta sin Link, nada se guarda). Bump para confirmar el deploy.
