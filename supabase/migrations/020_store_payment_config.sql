-- ============================================================================
-- Mercanta Business — Migration 020: Cuenta de Mercado Pago de la tienda (ventas)
-- ============================================================================
-- Separa el dinero: las SUSCRIPCIONES usan el token de la plataforma
-- (MERCADOPAGO_ACCESS_TOKEN en Vercel), y las VENTAS de productos usan el token
-- propio de la tienda guardado aquí. Tabla aparte (NO se expone en el catálogo
-- público; RLS solo dueño + lectura del empleado).
-- Requiere haber aplicado antes la migración 018 (función boss_store_id).
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS store_payment_config (
  store_id                 UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  mercadopago_access_token TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE store_payment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spc_owner" ON store_payment_config;
CREATE POLICY "spc_owner" ON store_payment_config FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "spc_employee_read" ON store_payment_config;
CREATE POLICY "spc_employee_read" ON store_payment_config FOR SELECT
  USING (store_id = boss_store_id());

-- ✅ Listo. Las ventas pueden cobrarse en la cuenta de Mercado Pago de la tienda.
