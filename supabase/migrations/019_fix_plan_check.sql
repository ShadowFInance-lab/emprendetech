-- ============================================================================
-- Mercanta Business — Migration 019: Arreglo del CHECK de plan (vip_plus)
-- ============================================================================
-- CAUSA del bug "el pago se completa pero el plan no se activa":
-- si la BD se creó solo con 000_complete_setup.sql, el CHECK de profiles.plan
-- NO incluye 'vip_plus' → el UPDATE del webhook falla con "violates check
-- constraint" y el plan nunca cambia. Esto lo corrige (idempotente).
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free','emprendedor','negocio','lifetime','vip_plus'));

-- ✅ Listo. Ahora el webhook puede activar el plan VIP Plus.
