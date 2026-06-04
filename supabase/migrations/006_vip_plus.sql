-- ============================================================================
-- EmprendeTech — Migration 006: Plan VIP Plus + contador de ventas medidas
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Agrega el plan 'vip_plus' a los CHECK y una tabla para el cobro medido.
-- ============================================================================

-- 1. Permitir 'vip_plus' en los CHECK constraints de plan
ALTER TABLE profiles      DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles      ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));

-- 2. Marcar qué ventas se hicieron con Mercado Pago directo (para el cobro medido)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS via_mercadopago BOOLEAN NOT NULL DEFAULT false;

-- 3. Tabla de cargos medidos VIP Plus (ventas MP por encima de las incluidas)
CREATE TABLE IF NOT EXISTS metered_charges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period        TEXT NOT NULL,                 -- 'YYYY-MM'
  mp_sales      INTEGER NOT NULL DEFAULT 0,    -- ventas MP en el periodo
  included      INTEGER NOT NULL DEFAULT 1000,
  extra_sales   INTEGER NOT NULL DEFAULT 0,    -- ventas por encima de lo incluido
  fee_per_sale  DECIMAL(6,2) NOT NULL DEFAULT 0.50,
  amount_due    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'accruing'
                CHECK (status IN ('accruing','invoiced','paid')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, period)
);

ALTER TABLE metered_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metered_owner" ON metered_charges;
CREATE POLICY "metered_owner" ON metered_charges FOR ALL USING (profile_id = auth.uid());

-- ✅ Listo. Plan VIP Plus habilitado.
