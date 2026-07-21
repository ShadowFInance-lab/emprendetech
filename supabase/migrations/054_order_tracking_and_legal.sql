-- ─── 054: Seguimiento de pedidos (tracking) + reportes (legal) ──────────────
--
-- TRACKING: al marcar un pedido como "enviado" se guarda la guía, la paquetería
-- y la fecha de envío. status_history acumula cada cambio de estado con su fecha
-- para mostrar una línea de tiempo real (al cliente y al dueño).
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS tracking_number  TEXT;
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMPTZ;
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS status_history   JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Rastreo público por número de orden (el cliente ve su pedido sin cuenta;
-- la lectura pública se hace con service-role filtrando por order_no).
CREATE INDEX IF NOT EXISTS idx_online_orders_order_no ON online_orders (order_no);

-- LEGAL: reportes de tiendas/pedidos que envían los visitantes. Inserción
-- pública; la plataforma los revisa desde el panel de Supabase (sin SELECT
-- público para no exponer los reportes de otros).
CREATE TABLE IF NOT EXISTS reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_slug     TEXT,
  order_no       TEXT,
  reason         TEXT NOT NULL,
  detail         TEXT,
  reporter_email TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert_any" ON reports;
CREATE POLICY "reports_insert_any" ON reports FOR INSERT WITH CHECK (true);
