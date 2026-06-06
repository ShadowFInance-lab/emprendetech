-- ============================================================================
-- EmprendeTech — Migration 013: Moneda por producto
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Cada producto puede tener su propia moneda (si no, usa la de la tienda).
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT;

-- ✅ Listo.
