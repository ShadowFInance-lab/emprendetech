-- ============================================================================
-- EmprendeTech — Migration 011: PIN de seguridad para cancelar/editar ventas
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Permite proteger la cancelación de ventas con un PIN (anti-robo de empleados).
-- ============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS sales_pin TEXT;

-- ✅ Listo.
