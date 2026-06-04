-- ============================================================================
-- EmprendeTech — Migration 007: Ofertas (precio comparativo / tachado)
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Agrega compare_at_price para mostrar precio tachado en ofertas.
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(12,2);

-- compare_at_price = precio ANTES de la oferta (NULL = sin oferta).
-- Cuando hay oferta: sale_price = precio con descuento, compare_at_price = precio original.

-- ✅ Listo.
