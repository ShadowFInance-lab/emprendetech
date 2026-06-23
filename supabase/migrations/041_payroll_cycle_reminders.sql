-- ============================================================================
-- Mercanta Business — Migration 041: ciclo de nómina personalizado + productos en recordatorios
-- ============================================================================
-- payroll_cycle_days/anchor = nómina "cada N días" con reinicio automático.
-- reminders.products = lista de productos del cliente en el recordatorio de entrega.
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS payroll_cycle_days   INTEGER NOT NULL DEFAULT 7;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payroll_cycle_anchor DATE;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS products TEXT;

-- ✅ Listo. Periodos personalizados de nómina + productos en recordatorios.
