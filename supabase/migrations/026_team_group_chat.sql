-- ============================================================================
-- Mercanta Business — Migration 026: Chat grupal del equipo (jefe + empleados)
-- ============================================================================
-- Un único hilo grupal por equipo (boss_id). Lo ven y escriben el dueño y todos
-- sus empleados. Requiere migración 018 (profiles.role/boss_id). SQL Editor.
-- ============================================================================

-- id del "jefe" del equipo del usuario actual (su id si es dueño, boss_id si es
-- empleado). SECURITY DEFINER evita recursión de RLS al leer profiles.
CREATE OR REPLACE FUNCTION my_team_boss()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT boss_id FROM profiles WHERE id = auth.uid() AND role = 'employee'),
    auth.uid()
  )
$$;
GRANT EXECUTE ON FUNCTION my_team_boss() TO authenticated;

CREATE TABLE IF NOT EXISTS team_group_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  sender_role TEXT NOT NULL DEFAULT 'employee',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE team_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tgm_read" ON team_group_messages;
CREATE POLICY "tgm_read" ON team_group_messages FOR SELECT
  USING (boss_id = my_team_boss());

DROP POLICY IF EXISTS "tgm_insert" ON team_group_messages;
CREATE POLICY "tgm_insert" ON team_group_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND boss_id = my_team_boss());

CREATE INDEX IF NOT EXISTS idx_tgm_boss ON team_group_messages(boss_id, created_at);

-- ✅ Listo. Chat grupal habilitado.
