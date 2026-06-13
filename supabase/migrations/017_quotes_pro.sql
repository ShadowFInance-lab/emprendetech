-- ============================================================================
-- Mercanta Business — Migration 017: Cotizaciones Profesionales
-- ============================================================================
-- Agrega datos de cliente, cierre (pago/anticipo/entrega), enlace público
-- de aprobación y firma digital. Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_email   TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_phone   TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_rfc     TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_method   TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_pct      NUMERIC;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_time    TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS public_token     TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature        TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_at        TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_public_token_idx
  ON quotes(public_token) WHERE public_token IS NOT NULL;

-- ✅ Listo. Cotizaciones profesionales habilitadas.
