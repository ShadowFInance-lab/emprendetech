-- ─── 061: La prueba gratis pasa de 5 a 7 días ───────────────────────────────
-- El trigger handle_new_user da la prueba al registrarse. Aquí se actualiza a
-- 7 días. NO toca a los usuarios existentes ni a los planes ya pagados.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, plan, plan_status, plan_expires_at, trial_used_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'emprendedor',
    'trial',
    now() + INTERVAL '7 days',   -- ← antes 5 days
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Opcional: extender a 7 días las pruebas EN CURSO (no toca planes pagados).
-- UPDATE profiles SET plan_expires_at = plan_expires_at + INTERVAL '2 days'
--  WHERE plan_status = 'trial' AND plan_expires_at > now();
