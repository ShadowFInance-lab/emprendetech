-- ============================================================
-- EmprendeIA SaaS — Migration 049: Trial 5 días al registrarse
-- ============================================================
-- Toda cuenta nueva nace con plan Emprendedor en prueba (5 días).
-- Se aplica en el trigger handle_new_user (SECURITY DEFINER).
-- plan_status CHECK: active|expired|cancelled|trial (NO 'trialing').
-- Respaldos en app: registerAction / OAuth / login / ensurePlanCurrent.
-- (La 043_trial_on_signup.sql es la misma lógica; este archivo alinea
--  el número con TODAS_PENDIENTES 049, donde 043 ya era variantes.)
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    plan,
    plan_status,
    plan_expires_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'emprendedor',
    'trial',
    now() + INTERVAL '5 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
