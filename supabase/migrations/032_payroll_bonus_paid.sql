-- ============================================================================
-- Mercanta Business — Migration 032: Bonos + estado de pago en nómina
-- ============================================================================
-- Agrega bono del periodo y marca de "pagado" tanto a empleados con login
-- (payroll, por periodo) como a empleados de registro (staff). SQL Editor.
-- ============================================================================

ALTER TABLE payroll ADD COLUMN IF NOT EXISTS bonus NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS paid  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE staff   ADD COLUMN IF NOT EXISTS bonus NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE staff   ADD COLUMN IF NOT EXISTS paid  BOOLEAN NOT NULL DEFAULT false;

-- ✅ Listo. Bonos y estado de pago habilitados.
