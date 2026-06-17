-- ============================================================================
-- Mercanta Business — Migration 033: Perfil de empleado + roles + tareas
-- ============================================================================
-- Campos de perfil (RFC, puesto, ingreso, foto), rol supervisor y módulo de
-- tareas asignables. Requiere 018 (role) y 024 (employee_meta). SQL Editor.
-- ============================================================================

ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS rfc       TEXT;
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS position  TEXT;
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD  CONSTRAINT profiles_role_check CHECK (role IN ('owner','employee','supervisor'));

CREATE OR REPLACE FUNCTION set_employee_role(emp_id uuid, new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new_role NOT IN ('employee','supervisor') THEN RAISE EXCEPTION 'bad_role'; END IF;
  UPDATE profiles SET role = new_role WHERE id = emp_id AND boss_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION set_employee_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION my_employee_roles()
RETURNS TABLE(id uuid, role text) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id, role FROM profiles WHERE boss_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION my_employee_roles() TO authenticated;

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE,
  done        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_boss" ON tasks;
CREATE POLICY "tasks_boss" ON tasks FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());
DROP POLICY IF EXISTS "tasks_assignee_read" ON tasks;
CREATE POLICY "tasks_assignee_read" ON tasks FOR SELECT USING (assigned_to = auth.uid());
DROP POLICY IF EXISTS "tasks_assignee_update" ON tasks;
CREATE POLICY "tasks_assignee_update" ON tasks FOR UPDATE
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- ✅ Listo. Perfil, roles y tareas habilitados.
