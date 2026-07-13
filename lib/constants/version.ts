/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.105'
export const APP_BUILD = '2026-07-13' // v7.105: forzar trial 5 días Emprendedor en TODAS las cuentas nuevas. Trigger handle_new_user (mig 043) + register/OAuth + respaldo ensurePlanCurrent (<24 h). UI: "Prueba gratis — termina en X días". plan_status='trial'.
