-- ============================================================================
-- 052: Reseñas de productos (estrellas 1-5 + comentarios moderados)
-- ----------------------------------------------------------------------------
-- Pégalo COMPLETO en: Supabase → SQL Editor → New query → Run.
-- Es seguro re-ejecutarlo (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- El filtro de palabras vulgares corre en el SERVIDOR (lib/actions/reviews.ts)
-- antes de insertar; aquí solo vive la tabla con su RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Lectura pública: las reseñas se muestran en el catálogo sin cuenta.
DROP POLICY IF EXISTS "reviews_read" ON product_reviews;
CREATE POLICY "reviews_read" ON product_reviews FOR SELECT USING (true);

-- Inserción pública: los compradores no necesitan cuenta para calificar.
DROP POLICY IF EXISTS "reviews_insert" ON product_reviews;
CREATE POLICY "reviews_insert" ON product_reviews FOR INSERT WITH CHECK (true);

-- Solo el dueño de la tienda puede borrar reseñas de sus productos.
DROP POLICY IF EXISTS "reviews_owner_delete" ON product_reviews;
CREATE POLICY "reviews_owner_delete" ON product_reviews FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ✅ LISTO. Las reseñas del catálogo quedan funcionando.
