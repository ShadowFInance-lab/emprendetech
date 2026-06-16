-- ============================================================================
-- Mercanta Business — Migration 030: Empleados "solo registro" (sin login)
-- ============================================================================
-- Empleados que solo aparecen en nómina/asistencia (no inician sesión en el POS).
-- No son usuarios de auth: el dueño edita sus datos manualmente. SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT, emergency_phone TEXT, insurance_no TEXT, branch TEXT,
  salary          NUMERIC NOT NULL DEFAULT 0,
  days_worked     INTEGER NOT NULL DEFAULT 0,
  absences        INTEGER NOT NULL DEFAULT 0,
  discount        NUMERIC NOT NULL DEFAULT 0,
  note            TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_boss" ON staff;
CREATE POLICY "staff_boss" ON staff FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

-- ✅ Listo. Empleados sin login habilitados.
