-- ============================================================================
-- Mercanta Business — Migration 038: Carrito de compras (ecommerce)
-- ============================================================================
-- carts / cart_items = carrito persistente del visitante anónimo (cookie mb_cart).
-- online_orders.order_no = número de orden legible para el cliente.
-- ============================================================================

ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS order_no TEXT;

CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID,
  name       TEXT NOT NULL,
  price      NUMERIC NOT NULL DEFAULT 0,
  qty        INTEGER NOT NULL DEFAULT 1,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- El carrito pertenece a visitantes anónimos identificados por el UUID del
-- carrito (guardado en cookie). El UUID es secreto/inadivinable; abrimos CRUD
-- por anon. No guarda datos sensibles.
ALTER TABLE carts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "carts_all" ON carts;
CREATE POLICY "carts_all" ON carts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cart_items_all" ON cart_items;
CREATE POLICY "cart_items_all" ON cart_items FOR ALL USING (true) WITH CHECK (true);

-- ✅ Listo. Carrito de compras habilitado.
