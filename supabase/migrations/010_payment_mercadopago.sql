-- ============================================================================
-- EmprendeTech — Migration 010: Método de pago "Mercado Pago" en ventas
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Permite registrar ventas con método de pago "mercadopago".
-- ============================================================================

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash','card','transfer','mercadopago','other'));

-- ✅ Listo.
