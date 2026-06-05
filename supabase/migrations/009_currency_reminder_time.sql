-- ============================================================================
-- EmprendeTech — Migration 009: Moneda de la tienda + hora en recordatorios
-- ============================================================================
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

-- 1. Moneda general de la tienda (afecta cómo se muestran los precios)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'MXN';

-- 2. Hora opcional en los recordatorios (para alarmas de entrega)
--    (requiere que ya exista la tabla reminders de la migración 008)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS due_time TIME;

-- ✅ Listo.
