/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.120'
export const APP_BUILD = '2026-07-20' // v7.120: FLUJO PAGO-PRIMERO — el pedido online se crea SOLO cuando Stripe confirma el pago (webhook), nunca antes; Ventas Online solo muestra pagos confirmados con indicadores (ID transacción, fecha, método). URL base centralizada en lib/utils/app-url (nunca localhost en prod: auth, Stripe, catálogo). Módulo Empleados reorganizado en 4 pestañas (Datos y Creación · Nómina · Chat · Tareas). Migración 053 (columnas de pago en online_orders).
