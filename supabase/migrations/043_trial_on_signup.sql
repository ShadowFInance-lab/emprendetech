-- ============================================================
-- EmprendeIA SaaS — Migration 043: Trial 5 días al registrarse
-- ============================================================
-- Toda cuenta nueva nace con plan Emprendedor en prueba (5 días).
-- Se aplica en el trigger handle_new_user (SECURITY DEFINER),
-- así no depende de service-role ni de la app para el primer grant.
-- Los respaldos en app (registerAction / OAuth / ensurePlanCurrent)
-- siguen existiendo por si el perfil se creó sin estos campos.
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
    plan_expires_at,
    trial_used_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'emprendedor',
    'trial',
    now() + INTERVAL '5 days',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
