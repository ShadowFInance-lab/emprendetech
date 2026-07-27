-- ─── 060: Marcar ventas como PRUEBA (no cuentan en el resumen de admin) ─────
-- No borra nada: solo permite excluir del resumen las ventas de desarrollo.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Marca automáticamente como prueba las ventas cobradas con Stripe en MODO TEST.
-- Los ids de Checkout Session de Stripe llevan prefijo: cs_test_ (prueba) y
-- cs_live_ (real); es la señal fiable para distinguirlas.
UPDATE sales SET is_test = true
 WHERE is_test = false
   AND (stripe_session_id LIKE 'cs_test_%' OR notes LIKE '%cs_test_%');

-- Ver cuántas quedaron marcadas:
-- SELECT is_test, count(*), sum(total) FROM sales GROUP BY is_test;
