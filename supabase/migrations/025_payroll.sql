-- ============================================================================
-- Mercanta Business — Migration 025: Nómina (descuentos por periodo)
-- ============================================================================
-- El sueldo base vive en employee_meta.salary; aquí guardamos el descuento del
-- periodo para calcular el neto. Requiere migración 024. Ejecutar en SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payroll (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boss_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  discount     NUMERIC NOT NULL DEFAULT 0,
  note         TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_start)
);
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_boss" ON payroll;
CREATE POLICY "payroll_boss" ON payroll FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

DROP POLICY IF EXISTS "payroll_employee_read" ON payroll;
CREATE POLICY "payroll_employee_read" ON payroll FOR SELECT
  USING (employee_id = auth.uid());

-- ✅ Listo. Nómina habilitada.
