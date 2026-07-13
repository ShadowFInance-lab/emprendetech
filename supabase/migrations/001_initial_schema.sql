-- ============================================================
-- EmprendeIA SaaS — Migration 001: Schema inicial
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── SECUENCIA PARA FOLIOS ──────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS sale_folio_seq START 1;

-- ─── PROFILES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  plan            TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free','emprendedor','negocio','lifetime')),
  plan_status     TEXT NOT NULL DEFAULT 'active'
                  CHECK (plan_status IN ('active','expired','cancelled','trial')),
  plan_expires_at TIMESTAMPTZ,
  trial_used_at   TIMESTAMPTZ, -- prueba gratis 5d solo una vez por cuenta
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STORES ─────────────────────────────────────────────────
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
  skin             TEXT NOT NULL DEFAULT 'moderna'
                   CHECK (skin IN ('moderna','minimalista')),
  primary_color    TEXT NOT NULL DEFAULT '#2563EB',
  secondary_color  TEXT NOT NULL DEFAULT '#1E40AF',
  button_color     TEXT NOT NULL DEFAULT '#16A34A',
  font_family      TEXT NOT NULL DEFAULT 'inter'
                   CHECK (font_family IN ('inter','playfair','poppins','roboto','montserrat')),
  product_order    TEXT NOT NULL DEFAULT 'featured'
                   CHECK (product_order IN ('featured','new','best_sellers','manual')),
  low_stock_alert  INTEGER NOT NULL DEFAULT 5,
  show_prices      BOOLEAN NOT NULL DEFAULT true,
  catalog_active   BOOLEAN NOT NULL DEFAULT true,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_slug ON stores(slug);

-- ─── CATEGORIES ─────────────────────────────────────────────
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

CREATE INDEX idx_categories_store ON categories(store_id, is_active);

-- ─── PRODUCTS ───────────────────────────────────────────────
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

CREATE INDEX idx_products_store_active ON products(store_id, is_active);
CREATE INDEX idx_products_store_category ON products(store_id, category_id);
CREATE INDEX idx_products_featured ON products(store_id, is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- ─── PRODUCT IMAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);

-- ─── CUSTOMERS ──────────────────────────────────────────────
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

CREATE INDEX idx_customers_store ON customers(store_id);

-- ─── SALES ──────────────────────────────────────────────────
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
  payment_method TEXT NOT NULL DEFAULT 'cash'
                 CHECK (payment_method IN ('cash','card','transfer','other')),
  status         TEXT NOT NULL DEFAULT 'completed'
                 CHECK (status IN ('completed','cancelled','refunded')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_store_date ON sales(store_id, created_at DESC);
CREATE INDEX idx_sales_store_status ON sales(store_id, status);
CREATE INDEX idx_sales_customer ON sales(customer_id) WHERE customer_id IS NOT NULL;

-- ─── SALE ITEMS ─────────────────────────────────────────────
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

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ─── INVENTORY MOVEMENTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
               CHECK (type IN ('sale','sale_cancel','manual_entry','manual_exit','adjustment')),
  quantity     INTEGER NOT NULL,  -- positivo=entrada, negativo=salida
  stock_before INTEGER NOT NULL,
  stock_after  INTEGER NOT NULL,
  reference_id UUID,              -- sale_id cuando type='sale'
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_product_date ON inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_movements_store_date ON inventory_movements(store_id, created_at DESC);

-- ─── ALERTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
             CHECK (type IN ('low_stock','out_of_stock')),
  title      TEXT NOT NULL,
  body       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_store_unread ON alerts(store_id, is_read, created_at DESC)
  WHERE is_read = false;

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────
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

CREATE INDEX idx_subscriptions_profile ON subscriptions(profile_id);

-- ─── PAYMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          DECIMAL(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  status          TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  provider_txn_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
