-- ============================================================
-- EmprendeIA SaaS — Migration 005: Datos demo (OPCIONAL)
-- ============================================================
-- Solo para PRUEBAS. Ejecutar DESPUÉS de crear un usuario y tienda
-- desde la app. Reemplaza 'TU_STORE_ID' con el ID real de tu tienda.
--
-- Para obtener tu store_id, ejecuta primero:
--   SELECT id, name FROM stores;
-- ============================================================

DO $$
DECLARE
  v_store_id UUID;
  v_cat_ropa UUID;
  v_cat_acc UUID;
  v_prod_id UUID;
BEGIN
  -- Tomar la primera tienda (ajusta si tienes varias)
  SELECT id INTO v_store_id FROM stores ORDER BY created_at LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE NOTICE 'No hay tiendas. Crea una desde la app primero.';
    RETURN;
  END IF;

  -- Categorías
  INSERT INTO categories (store_id, name, slug)
  VALUES (v_store_id, 'Ropa', 'ropa')
  RETURNING id INTO v_cat_ropa;

  INSERT INTO categories (store_id, name, slug)
  VALUES (v_store_id, 'Accesorios', 'accesorios')
  RETURNING id INTO v_cat_acc;

  -- Productos de ropa
  INSERT INTO products (store_id, category_id, name, slug, description, sku, cost_price, sale_price, stock, is_featured, is_new)
  VALUES
    (v_store_id, v_cat_ropa, 'Playera Básica Algodón', 'playera-basica', 'Playera 100% algodón, cómoda y fresca', 'PB-001', 80, 199, 25, true, true),
    (v_store_id, v_cat_ropa, 'Sudadera con Capucha', 'sudadera-capucha', 'Sudadera unisex, perfecta para el frío', 'SUD-001', 220, 499, 12, true, false),
    (v_store_id, v_cat_ropa, 'Pantalón de Mezclilla', 'pantalon-mezclilla', 'Jeans corte recto', 'PAN-001', 280, 650, 8, false, false);

  -- Productos de accesorios
  INSERT INTO products (store_id, category_id, name, slug, description, sku, cost_price, sale_price, stock, is_featured, is_new)
  VALUES
    (v_store_id, v_cat_acc, 'Collar de Plata 925', 'collar-plata-925', 'Collar artesanal en plata ley 925', 'COL-925', 120, 450, 15, true, true),
    (v_store_id, v_cat_acc, 'Aretes de Perla', 'aretes-perla', 'Aretes elegantes con perla cultivada', 'ARE-001', 90, 280, 20, false, true),
    (v_store_id, v_cat_acc, 'Pulsera de Charms', 'pulsera-charms', 'Pulsera ajustable con dijes', 'PUL-001', 70, 230, 3, false, false),
    (v_store_id, v_cat_acc, 'Gorra Deportiva', 'gorra-deportiva', 'Gorra ajustable bordada', 'GOR-001', 60, 180, 0, false, false);

  RAISE NOTICE 'Datos demo creados para la tienda: %', v_store_id;
END $$;
