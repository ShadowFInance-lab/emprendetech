-- ============================================================================
-- Mercanta Business — Migration 028: Descuentos generales de nómina
-- ============================================================================
-- Conceptos de descuento que aplican a todos los empleados (ISR, Seguro Social,
-- otros). Pueden ser % del sueldo base o monto fijo. Requiere 026 (my_team_boss).
-- ============================================================================

CREATE TABLE IF NOT EXISTS payroll_deductions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept     TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent','amount')),
  value       NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_boss" ON payroll_deductions;
CREATE POLICY "pd_boss" ON payroll_deductions FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

-- El empleado puede leer los descuentos de su jefe (para ver su recibo).
DROP POLICY IF EXISTS "pd_employee_read" ON payroll_deductions;
CREATE POLICY "pd_employee_read" ON payroll_deductions FOR SELECT
  USING (boss_id = my_team_boss());

-- ✅ Listo. Descuentos generales habilitados.
