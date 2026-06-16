-- ============================================================================
-- Mercanta Business — Migration 027: Recordatorios asignados a un empleado
-- ============================================================================
-- Permite que el dueño asigne un recordatorio de entrega a un empleado. Solo el
-- empleado asignado lo ve (y recibe la alarma) en su POS. Requiere 008. SQL Editor.
-- ============================================================================

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- El empleado asignado puede leer y marcar hecho su recordatorio (policy aditiva).
DROP POLICY IF EXISTS "reminders_assignee_read" ON reminders;
CREATE POLICY "reminders_assignee_read" ON reminders FOR SELECT
  USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "reminders_assignee_update" ON reminders;
CREATE POLICY "reminders_assignee_update" ON reminders FOR UPDATE
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reminders_assigned ON reminders(assigned_to) WHERE assigned_to IS NOT NULL;

-- ✅ Listo. Recordatorios asignables a empleados.
