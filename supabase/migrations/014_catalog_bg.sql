-- ============================================================================
-- EmprendeTech — Migration 014: Fondo del catálogo (color) + estilo de botón
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS bg_color TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS button_style TEXT;  -- 'cuadrado' | 'redondeado' | 'pildora'

-- ✅ Listo.
