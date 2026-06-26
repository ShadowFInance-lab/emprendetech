/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.71'
export const APP_BUILD = '2026-06-26' // v7.71: Arreglar botón Conectar MP (no redirige) - usar <button type="button" onClick={() => { window.location.href = '/api/oauth/mercadopago/start'; }} con clases grandes; sin form/submit interfiriendo. Commit v7.71 push.
