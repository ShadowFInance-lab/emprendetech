/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.105-safe'
export const APP_BUILD = '2026-07-13' // v7.105-safe: forzar trial 5 días Emprendedor en cuentas nuevas sin romper nada. plan_status='trial' (CHECK real de BD, no 'trialing'). registerAction + callback OAuth + respaldo en ensurePlanCurrentAction (<15 min, free, no employee). UI Suscripción: "Prueba gratis (5 días)". Retry perfil si el trigger tarda.
