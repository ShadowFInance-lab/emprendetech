-- ─── 053: Estado de pago en pedidos online (flujo PAGO-PRIMERO con Stripe) ───
--
-- Antes: el pedido se creaba en estado 'pendiente' ANTES de pagar y aparecía en
-- Ventas Online aunque no hubiera pago. Ahora el pedido lo crea el webhook de
-- Stripe (checkout.session.completed) SOLO cuando el pago se confirma, con estos
-- indicadores. Ventas Online filtra a payment_status = 'paid'.

ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS payment_status        TEXT;
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS stripe_session_id     TEXT;
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS paid_at               TIMESTAMPTZ;

-- Idempotencia a nivel BD: un webhook reintentado por Stripe no puede duplicar
-- el pedido (índice único parcial: permite varios NULL de filas heredadas).
CREATE UNIQUE INDEX IF NOT EXISTS idx_online_orders_session
  ON online_orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- Backfill de pedidos existentes: pagados = los que ya avanzaron del 'pendiente'.
UPDATE online_orders
   SET payment_status = CASE
     WHEN status IN ('pagado','preparando','enviado','entregado') THEN 'paid'
     ELSE 'pending'
   END
 WHERE payment_status IS NULL;
