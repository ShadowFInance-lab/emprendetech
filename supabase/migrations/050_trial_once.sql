-- ============================================================
-- EmprendeIA SaaS — Migration 050: Trial 5 días UNA sola vez
-- ============================================================
-- trial_used_at: si no es NULL, esa cuenta ya usó (o no es elegible
-- para) la prueba gratis. Nunca se re-otorga el trial.
-- Cuentas existentes se marcan para no regalarles trial de sorpresa.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

-- Cuentas ya existentes: no son "nuevas" → no reciben trial futuro.
UPDATE public.profiles
SET trial_used_at = COALESCE(created_at, now())
WHERE trial_used_at IS NULL;

-- Trigger: solo cuentas realmente nuevas (INSERT) reciben trial + marca.
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
