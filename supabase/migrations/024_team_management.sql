-- ============================================================================
-- Mercanta Business — Migration 024: Gestión avanzada de equipo
-- ============================================================================
-- Datos extra del empleado, atribución de ventas y chat jefe↔empleado.
-- Requiere migración 018 (role/boss_id). Ejecutar en Supabase → SQL Editor.
-- ============================================================================

-- IDs de los empleados del jefe que llama (SECURITY DEFINER evita recursión RLS)
CREATE OR REPLACE FUNCTION my_employee_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM profiles WHERE boss_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION my_employee_ids() TO authenticated;

-- ─── Datos extra del empleado ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_meta (
  employee_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           TEXT,
  insurance_no    TEXT,
  emergency_phone TEXT,
  branch          TEXT,
  salary          NUMERIC,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meta_self" ON employee_meta;
CREATE POLICY "meta_self" ON employee_meta FOR SELECT USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "meta_boss" ON employee_meta;
CREATE POLICY "meta_boss" ON employee_meta FOR ALL
  USING (employee_id IN (SELECT my_employee_ids()))
  WITH CHECK (employee_id IN (SELECT my_employee_ids()));

-- ─── Atribución de ventas (quién la registró) ──────────────────────────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_by UUID;

-- ─── Chat jefe ↔ empleado ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_role   TEXT NOT NULL CHECK (from_role IN ('boss','employee')),
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_access" ON team_messages;
CREATE POLICY "tm_access" ON team_messages FOR ALL
  USING (boss_id = auth.uid() OR employee_id = auth.uid())
  WITH CHECK (boss_id = auth.uid() OR employee_id = auth.uid());

-- ✅ Listo. Gestión avanzada de equipo habilitada.
