-- ============================================================================
-- EmprendeIA — SETUP COMPLETO EN UN SOLO PASTE
-- ============================================================================
-- Copia TODO este archivo y pégalo en: Supabase → SQL Editor → New query → Run
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.
-- Incluye: 12 tablas + RLS + triggers + bucket de storage + políticas.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════
-- 1. TABLAS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','emprendedor','negocio','lifetime')),
  plan_status     TEXT NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active','expired','cancelled','trial')),
  plan_expires_at TIMESTAMPTZ,
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  tagline          TEXT,
  logo_url         TEXT,
  banner_url       TEXT,
  whatsapp         TEXT,
  facebook         TEXT,
  instagram        TEXT,
  tiktok           TEXT,
  skin             TEXT NOT NULL DEFAULT 'moderna' CHECK (skin IN ('moderna','minimalista')),
  primary_color    TEXT NOT NULL DEFAULT '#2563EB',
  secondary_color  TEXT NOT NULL DEFAULT '#1E40AF',
  button_color     TEXT NOT NULL DEFAULT '#16A34A',
  font_family      TEXT NOT NULL DEFAULT 'inter' CHECK (font_family IN ('inter','playfair','poppins','roboto','montserrat')),
  product_order    TEXT NOT NULL DEFAULT 'featured' CHECK (product_order IN ('featured','new','best_sellers','manual')),
  low_stock_alert  INTEGER NOT NULL DEFAULT 5,
  show_prices      BOOLEAN NOT NULL DEFAULT true,
  catalog_active   BOOLEAN NOT NULL DEFAULT true,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  image_url  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id, is_active);

CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT,
  sku           TEXT,
  barcode       TEXT,
  cost_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock         INTEGER NOT NULL DEFAULT 0,
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_new        BOOLEAN NOT NULL DEFAULT true,
  total_sold    INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_store_category ON products(store_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(store_id, is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);

CREATE TABLE IF NOT EXISTS sales (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  folio          TEXT NOT NULL,
  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amt   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit         DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','transfer','other')),
  status         TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled','refunded')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_store_status ON sales(store_id, status);

CREATE TABLE IF NOT EXISTS sale_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   DECIMAL(12,2) NOT NULL,
  unit_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal     DECIMAL(12,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('sale','sale_cancel','manual_entry','manual_exit','adjustment')),
  quantity     INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after  INTEGER NOT NULL,
  reference_id UUID,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_product_date ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_store_date ON inventory_movements(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('low_stock','out_of_stock')),
  title      TEXT NOT NULL,
  body       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_store_unread ON alerts(store_id, is_read, created_at DESC) WHERE is_read = false;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan                 TEXT NOT NULL CHECK (plan IN ('free','emprendedor','negocio','lifetime')),
  status               TEXT NOT NULL CHECK (status IN ('active','cancelled','expired','trial')),
  provider             TEXT NOT NULL DEFAULT 'mercadopago',
  provider_sub_id      TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile ON subscriptions(profile_id);

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          DECIMAL(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  status          TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  provider_txn_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════
-- 2. ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (id = auth.uid());

DROP POLICY IF EXISTS "stores_owner_all" ON stores;
CREATE POLICY "stores_owner_all" ON stores FOR ALL USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "stores_public_read" ON stores;
CREATE POLICY "stores_public_read" ON stores FOR SELECT USING (catalog_active = true AND is_active = true);

DROP POLICY IF EXISTS "categories_owner_all" ON categories;
CREATE POLICY "categories_owner_all" ON categories FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT
  USING (is_active = true AND store_id IN (SELECT id FROM stores WHERE catalog_active = true AND is_active = true));

DROP POLICY IF EXISTS "products_owner_all" ON products;
CREATE POLICY "products_owner_all" ON products FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "products_public_read" ON products;
CREATE POLICY "products_public_read" ON products FOR SELECT
  USING (is_active = true AND store_id IN (SELECT id FROM stores WHERE catalog_active = true AND is_active = true));

DROP POLICY IF EXISTS "images_owner_all" ON product_images;
CREATE POLICY "images_owner_all" ON product_images FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));
DROP POLICY IF EXISTS "images_public_read" ON product_images;
CREATE POLICY "images_public_read" ON product_images FOR SELECT
  USING (product_id IN (
    SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id
    WHERE p.is_active = true AND s.catalog_active = true AND s.is_active = true));

DROP POLICY IF EXISTS "customers_owner_all" ON customers;
CREATE POLICY "customers_owner_all" ON customers FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "sales_owner_all" ON sales;
CREATE POLICY "sales_owner_all" ON sales FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "sale_items_owner_all" ON sale_items;
CREATE POLICY "sale_items_owner_all" ON sale_items FOR ALL
  USING (sale_id IN (SELECT id FROM sales WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));

DROP POLICY IF EXISTS "movements_owner_all" ON inventory_movements;
CREATE POLICY "movements_owner_all" ON inventory_movements FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "alerts_owner_all" ON alerts;
CREATE POLICY "alerts_owner_all" ON alerts FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "subscriptions_owner" ON subscriptions;
CREATE POLICY "subscriptions_owner" ON subscriptions FOR ALL USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "payments_owner" ON payments;
CREATE POLICY "payments_owner" ON payments FOR ALL
  USING (subscription_id IN (SELECT id FROM subscriptions WHERE profile_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════
-- 3. TRIGGERS Y FUNCIONES
-- ════════════════════════════════════════════════════════════════

-- Auto-crear profile al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Folio automático VTA-00001
CREATE OR REPLACE FUNCTION generate_sale_folio()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM sales WHERE store_id = NEW.store_id;
  NEW.folio := 'VTA-' || LPAD(v_count::TEXT, 5, '0');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS before_sale_insert ON sales;
CREATE TRIGGER before_sale_insert
  BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION generate_sale_folio();

-- Al vender: descontar stock + movimiento + alertas + stats cliente
CREATE OR REPLACE FUNCTION handle_sale_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_store_id UUID; v_stock_before INTEGER; v_stock_after INTEGER;
BEGIN
  SELECT store_id, stock INTO v_store_id, v_stock_before FROM products WHERE id = NEW.product_id;
  v_stock_after := v_stock_before - NEW.quantity;

  UPDATE products SET stock = v_stock_after, total_sold = total_sold + NEW.quantity, updated_at = now()
  WHERE id = NEW.product_id;

  INSERT INTO inventory_movements (store_id, product_id, type, quantity, stock_before, stock_after, reference_id, notes)
  VALUES (v_store_id, NEW.product_id, 'sale', -NEW.quantity, v_stock_before, v_stock_after, NEW.sale_id, 'Venta registrada');

  IF v_stock_after <= (SELECT low_stock_alert FROM stores WHERE id = v_store_id) AND v_stock_after > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM alerts WHERE store_id = v_store_id AND type = 'low_stock'
        AND (data->>'product_id')::UUID = NEW.product_id AND created_at > now() - INTERVAL '24 hours'
    ) THEN
      INSERT INTO alerts (store_id, type, title, body, data)
      VALUES (v_store_id, 'low_stock',
        'Stock bajo: ' || (SELECT name FROM products WHERE id = NEW.product_id),
        'Quedan ' || v_stock_after || ' unidades',
        jsonb_build_object('product_id', NEW.product_id, 'stock', v_stock_after));
    END IF;
  END IF;

  IF v_stock_after = 0 THEN
    INSERT INTO alerts (store_id, type, title, body, data)
    SELECT v_store_id, 'out_of_stock', 'Agotado: ' || name, 'Este producto se quedó sin stock',
      jsonb_build_object('product_id', NEW.product_id)
    FROM products WHERE id = NEW.product_id;
  END IF;

  IF (SELECT customer_id FROM sales WHERE id = NEW.sale_id) IS NOT NULL THEN
    UPDATE customers SET total_spent = total_spent + NEW.subtotal, updated_at = now()
    WHERE id = (SELECT customer_id FROM sales WHERE id = NEW.sale_id);
  END IF;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS after_sale_item_insert ON sale_items;
CREATE TRIGGER after_sale_item_insert
  AFTER INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION handle_sale_item_insert();

-- Al cancelar venta: devolver stock
CREATE OR REPLACE FUNCTION handle_sale_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_item RECORD; v_stock_before INTEGER; v_stock_after INTEGER;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    FOR v_item IN SELECT * FROM sale_items WHERE sale_id = NEW.id LOOP
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      v_stock_after := v_stock_before + v_item.quantity;
      UPDATE products SET stock = v_stock_after,
        total_sold = GREATEST(0, total_sold - v_item.quantity), updated_at = now()
      WHERE id = v_item.product_id;
      INSERT INTO inventory_movements (store_id, product_id, type, quantity, stock_before, stock_after, reference_id, notes)
      VALUES (NEW.store_id, v_item.product_id, 'sale_cancel', v_item.quantity, v_stock_before, v_stock_after, NEW.id,
        'Venta cancelada: ' || NEW.folio);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS after_sale_status_update ON sales;
CREATE TRIGGER after_sale_status_update
  AFTER UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION handle_sale_cancel();

-- updated_at automático
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS set_stores_updated_at ON stores;
CREATE TRIGGER set_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS set_products_updated_at ON products;
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS set_customers_updated_at ON customers;
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS set_sales_updated_at ON sales;
CREATE TRIGGER set_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 4. STORAGE (bucket público para logos / banners / fotos)
-- ════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
CREATE POLICY "authenticated_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-assets');
DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
CREATE POLICY "authenticated_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'public-assets');
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
CREATE POLICY "authenticated_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public-assets');
DROP POLICY IF EXISTS "public_read" ON storage.objects;
CREATE POLICY "public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'public-assets');

-- ════════════════════════════════════════════════════════════════
-- ✅ LISTO. 12 tablas + RLS + triggers + storage configurados.
-- ════════════════════════════════════════════════════════════════
