-- ============================================================================
-- Mercanta Business — Migration 035: Perfil completo para empleados de registro
-- ============================================================================
-- Mismos campos de perfil que los empleados con login (RFC, puesto, ingreso,
-- foto) para unificar el modal de edición. Requiere 030 (staff). SQL Editor.
-- ============================================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS rfc       TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS position  TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ✅ Listo. Empleados de registro con perfil completo.
