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

-- ─── 018: Modo Jefe / Empleado (roles) ─────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner'
  CHECK (role IN ('owner','employee'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boss_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION boss_store_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT s.id FROM stores s
  JOIN profiles p ON p.boss_id = s.owner_id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

DROP POLICY IF EXISTS "stores_employee_read" ON stores;
CREATE POLICY "stores_employee_read" ON stores FOR SELECT USING (id = boss_store_id());
DROP POLICY IF EXISTS "products_employee_read" ON products;
CREATE POLICY "products_employee_read" ON products FOR SELECT USING (store_id = boss_store_id());
DROP POLICY IF EXISTS "images_employee_read" ON product_images;
CREATE POLICY "images_employee_read" ON product_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND p.store_id = boss_store_id()));
DROP POLICY IF EXISTS "customers_employee_read" ON customers;
CREATE POLICY "customers_employee_read" ON customers FOR SELECT USING (store_id = boss_store_id());
DROP POLICY IF EXISTS "customers_employee_insert" ON customers;
CREATE POLICY "customers_employee_insert" ON customers FOR INSERT WITH CHECK (store_id = boss_store_id());
DROP POLICY IF EXISTS "sales_employee_read" ON sales;
CREATE POLICY "sales_employee_read" ON sales FOR SELECT USING (store_id = boss_store_id());
DROP POLICY IF EXISTS "sales_employee_insert" ON sales;
CREATE POLICY "sales_employee_insert" ON sales FOR INSERT WITH CHECK (store_id = boss_store_id());
DROP POLICY IF EXISTS "sale_items_employee_read" ON sale_items;
CREATE POLICY "sale_items_employee_read" ON sale_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.store_id = boss_store_id()));
DROP POLICY IF EXISTS "sale_items_employee_insert" ON sale_items;
CREATE POLICY "sale_items_employee_insert" ON sale_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.store_id = boss_store_id()));

CREATE TABLE IF NOT EXISTS employee_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empnotif_employee" ON employee_notifications;
CREATE POLICY "empnotif_employee" ON employee_notifications FOR ALL
  USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
DROP POLICY IF EXISTS "empnotif_sender_insert" ON employee_notifications;
CREATE POLICY "empnotif_sender_insert" ON employee_notifications FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- ─── 019: Arreglo del CHECK de plan (vip_plus) ─────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));

-- ─── 020: Cuenta de Mercado Pago de la tienda (solo ventas) ────────────────
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

-- ─── 021: Crear empleados sin service-role (RPCs SECURITY DEFINER) ──────────
CREATE OR REPLACE FUNCTION assign_employee(emp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  caller_plan text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT plan INTO caller_plan FROM profiles WHERE id = caller;
  IF caller_plan IS NULL OR caller_plan NOT IN ('emprendedor','negocio','vip_plus') THEN
    RAISE EXCEPTION 'plan_required';
  END IF;
  INSERT INTO profiles (id, role, boss_id, onboarding_done)
  VALUES (emp_id, 'employee', caller, true)
  ON CONFLICT (id) DO UPDATE SET role = 'employee', boss_id = caller, onboarding_done = true;
  UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = emp_id;
END; $$;
GRANT EXECUTE ON FUNCTION assign_employee(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION list_my_employees()
RETURNS TABLE (id uuid, full_name text, email text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, u.email::text, p.created_at
  FROM profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.boss_id = auth.uid()
  ORDER BY p.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION list_my_employees() TO authenticated;

CREATE OR REPLACE FUNCTION remove_employee(emp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET boss_id = NULL WHERE id = emp_id AND boss_id = auth.uid();
END; $$;
GRANT EXECUTE ON FUNCTION remove_employee(uuid) TO authenticated;

-- ─── 022: Imagen de fondo del catálogo ─────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS background_url TEXT;

-- ─── 023: Asistencia de empleados ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boss_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL DEFAULT current_date,
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "att_employee" ON employee_attendance;
CREATE POLICY "att_employee" ON employee_attendance FOR ALL
  USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
DROP POLICY IF EXISTS "att_boss" ON employee_attendance;
CREATE POLICY "att_boss" ON employee_attendance FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

-- ─── 024: Gestión avanzada de equipo ───────────────────────────────────────
CREATE OR REPLACE FUNCTION my_employee_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM profiles WHERE boss_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION my_employee_ids() TO authenticated;

CREATE TABLE IF NOT EXISTS employee_meta (
  employee_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           TEXT, insurance_no TEXT, emergency_phone TEXT, branch TEXT,
  salary          NUMERIC, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meta_self" ON employee_meta;
CREATE POLICY "meta_self" ON employee_meta FOR SELECT USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "meta_boss" ON employee_meta;
CREATE POLICY "meta_boss" ON employee_meta FOR ALL
  USING (employee_id IN (SELECT my_employee_ids())) WITH CHECK (employee_id IN (SELECT my_employee_ids()));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE TABLE IF NOT EXISTS team_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_role   TEXT NOT NULL CHECK (from_role IN ('boss','employee')),
  message     TEXT NOT NULL, read BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_access" ON team_messages;
CREATE POLICY "tm_access" ON team_messages FOR ALL
  USING (boss_id = auth.uid() OR employee_id = auth.uid())
  WITH CHECK (boss_id = auth.uid() OR employee_id = auth.uid());

-- ─── 025: Nómina (descuentos por periodo) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boss_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  discount     NUMERIC NOT NULL DEFAULT 0,
  note         TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_start)
);
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_boss" ON payroll;
CREATE POLICY "payroll_boss" ON payroll FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());
DROP POLICY IF EXISTS "payroll_employee_read" ON payroll;
CREATE POLICY "payroll_employee_read" ON payroll FOR SELECT
  USING (employee_id = auth.uid());

-- ─── 026: Chat grupal del equipo (jefe + empleados) ────────────────────────
-- Devuelve el id del "jefe" del equipo del usuario actual: su propio id si es
-- dueño, o boss_id si es empleado. SECURITY DEFINER evita recursión de RLS.
CREATE OR REPLACE FUNCTION my_team_boss()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT boss_id FROM profiles WHERE id = auth.uid() AND role = 'employee'),
    auth.uid()
  )
$$;
GRANT EXECUTE ON FUNCTION my_team_boss() TO authenticated;

CREATE TABLE IF NOT EXISTS team_group_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  sender_role TEXT NOT NULL DEFAULT 'employee',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE team_group_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgm_read" ON team_group_messages;
CREATE POLICY "tgm_read" ON team_group_messages FOR SELECT
  USING (boss_id = my_team_boss());
DROP POLICY IF EXISTS "tgm_insert" ON team_group_messages;
CREATE POLICY "tgm_insert" ON team_group_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND boss_id = my_team_boss());
CREATE INDEX IF NOT EXISTS idx_tgm_boss ON team_group_messages(boss_id, created_at);

-- ─── 027: Recordatorios asignados a un empleado específico ──────────────────
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS assigned_to UUID;
DROP POLICY IF EXISTS "reminders_assignee_read" ON reminders;
CREATE POLICY "reminders_assignee_read" ON reminders FOR SELECT
  USING (assigned_to = auth.uid());
DROP POLICY IF EXISTS "reminders_assignee_update" ON reminders;
CREATE POLICY "reminders_assignee_update" ON reminders FOR UPDATE
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());
CREATE INDEX IF NOT EXISTS idx_reminders_assigned ON reminders(assigned_to) WHERE assigned_to IS NOT NULL;

-- ─── 028: Descuentos generales de nómina (ISR, Seguro Social, otros) ────────
CREATE TABLE IF NOT EXISTS payroll_deductions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept     TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent','amount')),
  value       NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pd_boss" ON payroll_deductions;
CREATE POLICY "pd_boss" ON payroll_deductions FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());
DROP POLICY IF EXISTS "pd_employee_read" ON payroll_deductions;
CREATE POLICY "pd_employee_read" ON payroll_deductions FOR SELECT
  USING (boss_id = my_team_boss());

-- ✅ LISTO. Todas las funciones nuevas quedan activas.
