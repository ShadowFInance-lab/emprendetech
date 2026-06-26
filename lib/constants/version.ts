/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.65'
export const APP_BUILD = '2026-06-25' // v7.65: Nómina: campo Salida (time) en selector ahora mismo tamaño mediano w-20 h-6 como Horas/Entrada. Colores: fix persistencia real (no strip colors en retry del action) + force color update separado + aplicar --brand inmediatamente en client después de guardar para que se vean ya (no solo toast "guardado"). Build limpio.
