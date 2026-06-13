-- ============================================================================
-- Mercanta Business — Migration 015: Módulo de Cotizaciones
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  folio         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'borrador'
                CHECK (status IN ('borrador','enviada','aceptada','rechazada','expirada','convertida')),
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amt  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  valid_until   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_store_idx ON quotes(store_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quotes_owner" ON quotes;
CREATE POLICY "quotes_owner" ON quotes FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ✅ Listo. Módulo de Cotizaciones habilitado.
