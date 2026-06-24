-- ============================================================================
-- Mercanta Business — Migration 040: Rol "Gerente"
-- ============================================================================
-- Añade el rol 'gerente' (manager): más permisos que supervisor, menos que dueño.
-- ============================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- Normaliza roles inválidos antes de aplicar el constraint (evita error 23514).
UPDATE profiles SET role = CASE WHEN boss_id IS NULL THEN 'owner' ELSE 'employee' END
  WHERE role IS NULL OR role NOT IN ('owner','employee','supervisor','gerente');
ALTER TABLE profiles ADD  CONSTRAINT profiles_role_check CHECK (role IN ('owner','employee','supervisor','gerente'));

CREATE OR REPLACE FUNCTION set_employee_role(emp_id uuid, new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new_role NOT IN ('employee','supervisor','gerente') THEN RAISE EXCEPTION 'bad_role'; END IF;
  UPDATE profiles SET role = new_role WHERE id = emp_id AND boss_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION set_employee_role(uuid, text) TO authenticated;

-- ✅ Listo. Rol Gerente habilitado.
