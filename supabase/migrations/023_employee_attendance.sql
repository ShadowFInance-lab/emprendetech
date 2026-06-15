-- ============================================================================
-- Mercanta Business — Migration 023: Asistencia de empleados
-- ============================================================================
-- Registro de entrada/salida por empleado y notas del jefe.
-- Requiere la migración 018 (role/boss_id). Ejecutar en Supabase → SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boss_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL DEFAULT current_date,
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;

-- El empleado gestiona sus propias filas (entrada/salida)
DROP POLICY IF EXISTS "att_employee" ON employee_attendance;
CREATE POLICY "att_employee" ON employee_attendance FOR ALL
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- El jefe lee y edita (notas) la asistencia de sus empleados
DROP POLICY IF EXISTS "att_boss" ON employee_attendance;
CREATE POLICY "att_boss" ON employee_attendance FOR ALL
  USING (boss_id = auth.uid())
  WITH CHECK (boss_id = auth.uid());

-- ✅ Listo. Asistencia de empleados habilitada.
