-- ============================================================================
-- Mercanta Business — Migration 021: Crear empleados SIN service-role key
-- ============================================================================
-- Permite crear/listar/quitar empleados usando solo el ANON key + funciones
-- SECURITY DEFINER (no requiere SUPABASE_SERVICE_ROLE_KEY en Vercel).
-- Requiere la migración 018 (columnas role/boss_id).
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

-- Marca a un usuario recién registrado como EMPLEADO del dueño que llama,
-- y le confirma el correo para que pueda iniciar sesión de inmediato.
CREATE OR REPLACE FUNCTION assign_employee(emp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  caller_plan text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT plan INTO caller_plan FROM profiles WHERE id = caller;
  IF caller_plan IS NULL OR caller_plan NOT IN ('emprendedor','negocio','vip_plus') THEN
    RAISE EXCEPTION 'plan_required';
  END IF;

  INSERT INTO profiles (id, role, boss_id, onboarding_done)
  VALUES (emp_id, 'employee', caller, true)
  ON CONFLICT (id) DO UPDATE
    SET role = 'employee', boss_id = caller, onboarding_done = true;

  -- Auto-confirmar el correo del empleado (para que pueda entrar sin email)
  UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = emp_id;
END; $$;
GRANT EXECUTE ON FUNCTION assign_employee(uuid) TO authenticated;

-- Lista los empleados del dueño que llama (con su correo)
CREATE OR REPLACE FUNCTION list_my_employees()
RETURNS TABLE (id uuid, full_name text, email text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, u.email::text, p.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.boss_id = auth.uid()
  ORDER BY p.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION list_my_employees() TO authenticated;

-- Quita el acceso de un empleado (deja de pertenecer a la tienda del dueño)
CREATE OR REPLACE FUNCTION remove_employee(emp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET boss_id = NULL
  WHERE id = emp_id AND boss_id = auth.uid();
END; $$;
GRANT EXECUTE ON FUNCTION remove_employee(uuid) TO authenticated;

-- ✅ Listo. Crear empleados ya no requiere service-role key.
