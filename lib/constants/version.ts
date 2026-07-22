/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.136'
export const APP_BUILD = '2026-07-21' // v7.136: EMPLEADOS definitivo — la app NUNCA usa una tabla "employees" (usa profiles+employee_meta); el error 'relation employees does not exist' venía de SQL externo. Migración 057 (idempotente): (re)crea employee_meta + employee_attendance + funciones my_employee_ids/list_my_employees + RLS, SIEMBRA una fila de meta vacía por empleado (el modal siempre carga), y crea una VISTA de compatibilidad "employees". Código: bossOwnsEmployee ahora verifica por profiles.boss_id (fiable) — guardar meta/foto funciona aunque el RPC esté roto. Más logs. // Historial en git.
