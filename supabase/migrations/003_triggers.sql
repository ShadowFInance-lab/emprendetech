-- ============================================================
-- EmprendeIA SaaS — Migration 003: Triggers y Funciones
-- ============================================================

-- ─── TRIGGER: Auto-crear profile al registrarse ──────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Toda cuenta nueva: 5 días Emprendedor (prueba una sola vez).
  INSERT INTO public.profiles (
    id, full_name, plan, plan_status, plan_expires_at, trial_used_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'emprendedor',
    'trial',
    now() + INTERVAL '5 days',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── TRIGGER: Folio automático en ventas ─────────────────────
CREATE OR REPLACE FUNCTION generate_sale_folio()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar ventas previas de esta tienda para folio secuencial
  SELECT COUNT(*) + 1 INTO v_count
  FROM sales
  WHERE store_id = NEW.store_id;

  NEW.folio := 'VTA-' || LPAD(v_count::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_sale_insert ON sales;
CREATE TRIGGER before_sale_insert
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION generate_sale_folio();

-- ─── TRIGGER: Al insertar sale_item → descontar stock ────────
CREATE OR REPLACE FUNCTION handle_sale_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_store_id     UUID;
  v_stock_before INTEGER;
  v_stock_after  INTEGER;
BEGIN
  -- Obtener stock actual
  SELECT store_id, stock INTO v_store_id, v_stock_before
  FROM products WHERE id = NEW.product_id;

  -- Calcular stock nuevo
  v_stock_after := v_stock_before - NEW.quantity;

  -- Actualizar stock
  UPDATE products
  SET stock = v_stock_after,
      total_sold = total_sold + NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;

  -- Registrar movimiento de inventario
  INSERT INTO inventory_movements (
    store_id, product_id, type,
    quantity, stock_before, stock_after,
    reference_id, notes
  ) VALUES (
    v_store_id, NEW.product_id, 'sale',
    -NEW.quantity, v_stock_before, v_stock_after,
    NEW.sale_id, 'Venta registrada'
  );

  -- Crear alerta si stock queda bajo
  IF v_stock_after <= (
    SELECT low_stock_alert FROM stores WHERE id = v_store_id
  ) AND v_stock_after > 0 THEN
    -- Evitar alertas duplicadas (solo 1 por producto por día)
    IF NOT EXISTS (
      SELECT 1 FROM alerts
      WHERE store_id = v_store_id
        AND type = 'low_stock'
        AND (data->>'product_id')::UUID = NEW.product_id
        AND created_at > now() - INTERVAL '24 hours'
    ) THEN
      INSERT INTO alerts (store_id, type, title, body, data)
      VALUES (
        v_store_id,
        'low_stock',
        'Stock bajo: ' || (SELECT name FROM products WHERE id = NEW.product_id),
        'Quedan ' || v_stock_after || ' unidades',
        jsonb_build_object('product_id', NEW.product_id, 'stock', v_stock_after)
      );
    END IF;
  END IF;

  -- Crear alerta de agotado
  IF v_stock_after = 0 THEN
    INSERT INTO alerts (store_id, type, title, body, data)
    SELECT
      v_store_id,
      'out_of_stock',
      'Agotado: ' || name,
      'Este producto se ha quedado sin stock',
      jsonb_build_object('product_id', NEW.product_id)
    FROM products WHERE id = NEW.product_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- Actualizar total_spent del cliente
  IF (SELECT customer_id FROM sales WHERE id = NEW.sale_id) IS NOT NULL THEN
    UPDATE customers
    SET total_spent = total_spent + NEW.subtotal,
        updated_at = now()
    WHERE id = (SELECT customer_id FROM sales WHERE id = NEW.sale_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_sale_item_insert ON sale_items;
CREATE TRIGGER after_sale_item_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION handle_sale_item_insert();

-- ─── TRIGGER: Al cancelar venta → devolver stock ─────────────
CREATE OR REPLACE FUNCTION handle_sale_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_stock_before INTEGER;
  v_stock_after  INTEGER;
BEGIN
  -- Solo procesar si el status cambia A 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    FOR v_item IN
      SELECT * FROM sale_items WHERE sale_id = NEW.id
    LOOP
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      v_stock_after := v_stock_before + v_item.quantity;

      UPDATE products
      SET stock = v_stock_after,
          total_sold = GREATEST(0, total_sold - v_item.quantity),
          updated_at = now()
      WHERE id = v_item.product_id;

      INSERT INTO inventory_movements (
        store_id, product_id, type,
        quantity, stock_before, stock_after,
        reference_id, notes
      ) VALUES (
        NEW.store_id, v_item.product_id, 'sale_cancel',
        v_item.quantity, v_stock_before, v_stock_after,
        NEW.id, 'Venta cancelada: ' || NEW.folio
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_sale_status_update ON sales;
CREATE TRIGGER after_sale_status_update
  AFTER UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION handle_sale_cancel();

-- ─── TRIGGER: updated_at automático ─────────────────────────
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
