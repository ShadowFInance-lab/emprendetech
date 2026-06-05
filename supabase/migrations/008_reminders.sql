-- ============================================================================
-- EmprendeTech — Migration 008: Recordatorios de entrega (por cliente)
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Permite agendar recordatorios de entrega/seguimiento ligados a un cliente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  due_date     DATE,
  done         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_store_idx    ON reminders(store_id);
CREATE INDEX IF NOT EXISTS reminders_customer_idx ON reminders(customer_id);
CREATE INDEX IF NOT EXISTS reminders_due_idx      ON reminders(due_date) WHERE done = false;

-- RLS: el dueño de la tienda gestiona sus recordatorios
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_owner" ON reminders;
CREATE POLICY "reminders_owner" ON reminders FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ✅ Listo. Recordatorios de entrega habilitados.
