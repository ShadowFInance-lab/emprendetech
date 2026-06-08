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

-- ✅ LISTO. Todas las funciones nuevas quedan activas.
