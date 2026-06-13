-- ============================================================================
-- Mercanta Business — Migration 018: Modo Jefe / Empleado (roles)
-- ============================================================================
-- Agrega roles a profiles y políticas ADITIVAS para que los empleados puedan
-- operar el POS de la tienda de su jefe. NO modifica las políticas del dueño.
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner'
  CHECK (role IN ('owner','employee'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boss_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Store del jefe del usuario actual (SECURITY DEFINER evita recursión de RLS)
CREATE OR REPLACE FUNCTION boss_store_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT s.id FROM stores s
  JOIN profiles p ON p.boss_id = s.owner_id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- ─── Políticas aditivas para empleados (se suman a las del dueño) ───────────
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

-- Empleados pueden CREAR y VER ventas, pero NO cancelarlas (sin UPDATE/DELETE)
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

-- ─── Notificaciones del jefe a empleados específicos ───────────────────────
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

-- ✅ Listo. Modo Jefe/Empleado habilitado.
