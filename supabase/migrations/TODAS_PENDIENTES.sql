-- ============================================================================
-- EmprendeTech — TODAS las migraciones pendientes (006 → 010) en UN solo bloque
-- ----------------------------------------------------------------------------
-- Pégalo COMPLETO en: Supabase → SQL Editor → New query → Run
-- Es seguro re-ejecutarlo (usa IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================================

-- ─── 006: Plan VIP Plus + cobro medido ─────────────────────────────────────
ALTER TABLE profiles      DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles      ADD  CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD  CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS via_mercadopago BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS metered_charges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period        TEXT NOT NULL,
  mp_sales      INTEGER NOT NULL DEFAULT 0,
  included      INTEGER NOT NULL DEFAULT 1000,
  extra_sales   INTEGER NOT NULL DEFAULT 0,
  fee_per_sale  DECIMAL(6,2) NOT NULL DEFAULT 0.50,
  amount_due    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'accruing' CHECK (status IN ('accruing','invoiced','paid')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, period)
);
ALTER TABLE metered_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metered_owner" ON metered_charges;
CREATE POLICY "metered_owner" ON metered_charges FOR ALL USING (profile_id = auth.uid());

-- ─── 007: Ofertas (precio tachado) ─────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(12,2);

-- ─── 008: Recordatorios de entrega ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  due_date     DATE,
  done         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_store_idx    ON reminders(store_id);
CREATE INDEX IF NOT EXISTS reminders_customer_idx ON reminders(customer_id);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_owner" ON reminders;
CREATE POLICY "reminders_owner" ON reminders FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ─── 009: Moneda de la tienda + hora en recordatorios ──────────────────────
ALTER TABLE stores    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'MXN';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS due_time TIME;

-- ─── 010: Método de pago Mercado Pago ──────────────────────────────────────
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD  CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash','card','transfer','mercadopago','other'));

-- ─── 011: PIN de seguridad para cancelar ventas ────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sales_pin TEXT;

-- ─── 012: Red social YouTube ───────────────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS youtube TEXT;

-- ─── 013: Moneda por producto ──────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT;

-- ─── 014: Fondo del catálogo + estilo de botón ─────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS bg_color TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS button_style TEXT;

-- ─── 015: Módulo de Cotizaciones ───────────────────────────────────────────
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

-- ─── 016: Conexiones sociales (tokens OAuth, ej. TikTok) ────────────────────
CREATE TABLE IF NOT EXISTS social_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  account_name  TEXT,
  account_id    TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_owner" ON social_connections;
CREATE POLICY "social_owner" ON social_connections FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 017: Cotizaciones profesionales ───────────────────────────────────────
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

-- ✅ LISTO. Todas las funciones nuevas quedan activas.
