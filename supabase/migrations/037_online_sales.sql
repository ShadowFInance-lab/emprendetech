-- ============================================================================
-- Mercanta Business — Migration 037: Vender Online (checkout)
-- ============================================================================
-- online_sales = activa el botón "Compra Online" en el catálogo público.
-- online_orders = pedidos online (cualquiera puede crear; solo el dueño los lee).
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS online_sales BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS online_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name TEXT, phone TEXT, email TEXT,
  address TEXT, city TEXT, state TEXT, zip TEXT, notes TEXT,
  payment_method TEXT,
  items JSONB, total NUMERIC,
  status        TEXT NOT NULL DEFAULT 'pendiente',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oo_insert_any" ON online_orders;
CREATE POLICY "oo_insert_any" ON online_orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "oo_owner_read" ON online_orders;
CREATE POLICY "oo_owner_read" ON online_orders FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "oo_owner_update" ON online_orders;
CREATE POLICY "oo_owner_update" ON online_orders FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ✅ Listo. Venta online habilitada.
