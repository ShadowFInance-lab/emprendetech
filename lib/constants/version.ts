/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.91'
export const APP_BUILD = '2026-07-02' // v7.91: limpieza Stripe — widget "Cobro rápido" ELIMINADO (archivo incluido); el único punto Stripe es el método Tarjeta del POS (Checkout directo por el total, venta auto-registrada por webhook). Mismo POS jefe/empleados. (Pediste "v7.90" pero ya existía; va como v7.91.)
