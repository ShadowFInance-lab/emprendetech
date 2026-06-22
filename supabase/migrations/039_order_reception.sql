-- ============================================================================
-- Mercanta Business — Migration 039: Recepción de pedidos online
-- ============================================================================
-- Permite elegir a quién llegan los pedidos online: a un Empleado o a una Sucursal.
-- branches = sucursales del negocio.
-- stores.online_reception_* = preferencia elegida (tipo + id + nombre legible).
-- El nombre legible se copia al pedido (en notes: "[Recepción: ...]").
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS branches_owner ON branches;
CREATE POLICY branches_owner ON branches FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

ALTER TABLE stores ADD COLUMN IF NOT EXISTS online_reception_type  TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS online_reception_id    TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS online_reception_value TEXT;

-- ✅ Listo. Recepción de pedidos habilitada.
