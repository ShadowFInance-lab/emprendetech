-- ============================================================================
-- Mercanta Business — Migration 036: colores del panel + ajuste de fondo +
--                      asistencia semanal para empleados de registro
-- ============================================================================
-- panel_* = 3 tonos para el panel de admin (independientes del catálogo).
-- bg_fit  = cómo se ajusta la imagen de fondo del catálogo (cover/contain/center).
-- staff.week_attendance = asistencia L-D para empleados sin login (JSON date->estado).
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS panel_primary   TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS panel_secondary TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS panel_button    TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS bg_fit          TEXT DEFAULT 'cover';
ALTER TABLE staff  ADD COLUMN IF NOT EXISTS week_attendance JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ✅ Listo. Tema del panel + ajuste de fondo + asistencia de registro.
