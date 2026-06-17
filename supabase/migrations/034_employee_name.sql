-- ============================================================================
-- Mercanta Business — Migration 034: Nombre del empleado editable por el jefe
-- ============================================================================
-- Permite al jefe renombrar a un empleado con login (actualiza profiles y el
-- metadato de auth). Requiere 018 (boss_id). Ejecutar en SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION set_employee_name(emp_id uuid, new_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = emp_id AND boss_id = auth.uid()) THEN RETURN; END IF;
  UPDATE profiles SET full_name = new_name WHERE id = emp_id;
  UPDATE auth.users SET raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(new_name)) WHERE id = emp_id;
END $$;
GRANT EXECUTE ON FUNCTION set_employee_name(uuid, text) TO authenticated;

-- ✅ Listo. Nombre de empleado editable.
