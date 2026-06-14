-- ============================================================================
-- Mercanta Business — Migration 022: Imagen de fondo del catálogo
-- ============================================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS background_url TEXT;
-- ✅ Listo. El catálogo puede tener imagen de fondo.
