-- ============================================================
-- EmprendeIA SaaS — Migration 002: Row Level Security
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;

-- ─── FUNCIÓN HELPER: obtener store_id del usuario ────────────
CREATE OR REPLACE FUNCTION get_user_store_id(user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM stores WHERE owner_id = user_id LIMIT 1;
$$;

-- ─── PROFILES ───────────────────────────────────────────────
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (id = auth.uid());

-- ─── STORES ─────────────────────────────────────────────────
-- Dueño: CRUD completo
CREATE POLICY "stores_owner_all" ON stores
  FOR ALL USING (owner_id = auth.uid());

-- Público: solo lectura de tiendas activas (para catálogo)
CREATE POLICY "stores_public_read" ON stores
  FOR SELECT USING (catalog_active = true AND is_active = true);

-- ─── CATEGORIES ─────────────────────────────────────────────
-- Dueño: CRUD completo
CREATE POLICY "categories_owner_all" ON categories
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Público: lectura de categorías activas
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (
    is_active = true AND
    store_id IN (SELECT id FROM stores WHERE catalog_active = true AND is_active = true)
  );

-- ─── PRODUCTS ───────────────────────────────────────────────
-- Dueño: CRUD completo
CREATE POLICY "products_owner_all" ON products
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Público: lectura de productos activos
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (
    is_active = true AND
    store_id IN (SELECT id FROM stores WHERE catalog_active = true AND is_active = true)
  );

-- ─── PRODUCT IMAGES ─────────────────────────────────────────
-- Dueño: CRUD completo
CREATE POLICY "images_owner_all" ON product_images
  FOR ALL USING (
    product_id IN (
      SELECT id FROM products WHERE
        store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

-- Público: lectura
CREATE POLICY "images_public_read" ON product_images
  FOR SELECT USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE p.is_active = true AND s.catalog_active = true AND s.is_active = true
    )
  );

-- ─── CUSTOMERS ──────────────────────────────────────────────
CREATE POLICY "customers_owner_all" ON customers
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ─── SALES ──────────────────────────────────────────────────
CREATE POLICY "sales_owner_all" ON sales
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ─── SALE ITEMS ─────────────────────────────────────────────
CREATE POLICY "sale_items_owner_all" ON sale_items
  FOR ALL USING (
    sale_id IN (
      SELECT id FROM sales WHERE
        store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    )
  );

-- ─── INVENTORY MOVEMENTS ────────────────────────────────────
CREATE POLICY "movements_owner_all" ON inventory_movements
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ─── ALERTS ─────────────────────────────────────────────────
CREATE POLICY "alerts_owner_all" ON alerts
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────
CREATE POLICY "subscriptions_owner" ON subscriptions
  FOR ALL USING (profile_id = auth.uid());

-- ─── PAYMENTS ───────────────────────────────────────────────
CREATE POLICY "payments_owner" ON payments
  FOR ALL USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE profile_id = auth.uid()
    )
  );
