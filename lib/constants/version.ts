/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.99'
export const APP_BUILD = '2026-07-02' // v7.99: reportes Excel/PDF solo en planes pagos — isPaid real (antes hardcodeado true) en /sales y /dashboard; candado con link a Suscripción en ExportSalesButtons; banner de plan Gratis y candado de DailySalesExport activados.
