-- ============================================================================
-- Mercanta Business — Migración 057: REPARACIÓN ROBUSTA DE EMPLEADOS
-- ============================================================================
-- Corre esto en Supabase → SQL Editor. Es IDEMPOTENTE (se puede correr las
-- veces que sea). Repara el sistema de empleados si faltan tablas/funciones.
--
-- IMPORTANTE: la app NO usa una tabla llamada "employees". Usa profiles
-- (con role/boss_id) + employee_meta. El error 'relation "employees" does not
-- exist' viene de SQL externo; al final se crea una VISTA de compatibilidad.
-- ============================================================================

-- 1) DATOS EXTRA DEL EMPLEADO (teléfono, NSS, RFC, puesto, sucursal, foto…)
CREATE TABLE IF NOT EXISTS employee_meta (
  employee_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           TEXT,
  insurance_no    TEXT,
  emergency_phone TEXT,
  branch          TEXT,
  salary          NUMERIC,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS rfc       TEXT;
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS position  TEXT;
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employee_meta ENABLE ROW LEVEL SECURITY;

-- 2) FUNCIONES (SECURITY DEFINER; consultan profiles, NUNCA "employees")
CREATE OR REPLACE FUNCTION my_employee_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM profiles WHERE boss_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION my_employee_ids() TO authenticated;

CREATE OR REPLACE FUNCTION list_my_employees()
RETURNS TABLE (id uuid, full_name text, email text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, u.email::text, p.created_at
  FROM profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.boss_id = auth.uid()
  ORDER BY p.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION list_my_employees() TO authenticated;

-- 3) RLS de employee_meta: el empleado ve la suya; el jefe la de sus empleados.
DROP POLICY IF EXISTS "meta_self" ON employee_meta;
CREATE POLICY "meta_self" ON employee_meta FOR SELECT USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "meta_boss" ON employee_meta;
CREATE POLICY "meta_boss" ON employee_meta FOR ALL
  USING (employee_id IN (SELECT my_employee_ids()))
  WITH CHECK (employee_id IN (SELECT my_employee_ids()));

-- 4) ASISTENCIA
CREATE TABLE IF NOT EXISTS employee_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boss_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL DEFAULT current_date,
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "att_employee" ON employee_attendance;
CREATE POLICY "att_employee" ON employee_attendance FOR ALL
  USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
DROP POLICY IF EXISTS "att_boss" ON employee_attendance;
CREATE POLICY "att_boss" ON employee_attendance FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

-- 5) Crea una fila de meta VACÍA para cada empleado que no tenga (así el modal
--    siempre carga algo y el jefe solo completa los campos).
INSERT INTO employee_meta (employee_id)
  SELECT id FROM profiles WHERE boss_id IS NOT NULL
  ON CONFLICT (employee_id) DO NOTHING;

-- 6) VISTA de compatibilidad "employees" (resuelve 'relation "employees" does
--    not exist' de scripts externos). Solo lectura; la app NO la usa.
CREATE OR REPLACE VIEW employees AS
  SELECT p.id, p.full_name AS name, p.boss_id, p.role,
         m.phone, m.rfc, m.position, m.branch, m.hire_date, m.photo_url,
         m.insurance_no, m.emergency_phone, m.salary, p.created_at
  FROM profiles p
  LEFT JOIN employee_meta m ON m.employee_id = p.id
  WHERE p.boss_id IS NOT NULL;
GRANT SELECT ON employees TO authenticated;

-- ✅ LISTO. Empleados reparados. Recarga el panel y abre el modal de un empleado.
