/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.137'
export const APP_BUILD = '2026-07-22' // v7.137: (1) EMPLEADOS — getEmployeeMeta SIEMPRE devuelve objeto completo y crea la fila si falta; saveEmployeeMetaAction con upsert onConflict:'employee_id' (antes chocaba con la fila sembrada y no persistía) + verificación leyendo de vuelta + logs "Meta cargada". (2) STRIPE — la comprobación de la cuenta conectada YA NO BLOQUEA el cobro (si no es usable se cobra a la plataforma) y hay reintento sin destino si Stripe lo rechaza; el webhook ahora registra SIEMPRE las ventas del POS (source=pos) aunque los items no quepan en metadata. // v7.136: EMPLEADOS definitivo — la app NUNCA usa una tabla "employees" (usa profiles+employee_meta); el error 'relation employees does not exist' venía de SQL externo. Migración 057 (idempotente): (re)crea employee_meta + employee_attendance + funciones my_employee_ids/list_my_employees + RLS, SIEMBRA una fila de meta vacía por empleado (el modal siempre carga), y crea una VISTA de compatibilidad "employees". Código: bossOwnsEmployee ahora verifica por profiles.boss_id (fiable) — guardar meta/foto funciona aunque el RPC esté roto. Más logs. // Historial en git.
