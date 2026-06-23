-- ============================================================================
-- Mercanta Business — Migration 042: Imagen de fondo del panel (dashboard)
-- ============================================================================
-- Sin esta columna, la subida guardaba el archivo pero fallaba al guardar el
-- enlace ("Se subió la imagen pero no se guardó el enlace").
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS dashboard_bg_url TEXT;

-- ✅ Listo. Imagen de fondo del dashboard habilitada.
