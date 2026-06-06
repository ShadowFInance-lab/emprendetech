-- ============================================================================
-- EmprendeTech — Migration 012: Red social YouTube
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS youtube TEXT;

-- ✅ Listo.
