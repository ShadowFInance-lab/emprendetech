/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.105'
export const APP_BUILD = '2026-07-13' // v7.105: trial 5d Emprendedor en TODAS las cuentas nuevas. Trigger handle_new_user (mig 043/049) + register/Google/login + ensurePlanCurrent (<24 h). UI clara: "Prueba gratis — termina en X días". plan_status='trial' (CHECK BD; no trialing).
