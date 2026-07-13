-- ============================================================
-- EmprendeIA SaaS — Migration 051: Forzar trial si nunca se usó
-- ============================================================
-- Reabre elegibilidad para cuentas free/active que NUNCA consumieron
-- un trial real (status no expired/cancelled). El backfill de 050 marcaba
-- a todos; aquí liberamos free+active para que la app otorgue 5 días.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

-- Liberar marca solo si están en Gratis activo sin vencimiento
-- (no reabre a quienes ya bajaron de trial → plan_status = expired).
UPDATE public.profiles
SET trial_used_at = NULL
WHERE plan = 'free'
  AND COALESCE(plan_status, 'active') = 'active'
  AND plan_expires_at IS NULL;

-- Trigger: cuentas nuevas → trial 5d + marca inmediata.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, plan, plan_status, plan_expires_at, trial_used_at
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
