-- ============================================================================
-- Mercanta Business — Migration 029: Cartocena (fondo/colecta del equipo)
-- ============================================================================
-- Fondo semanal del equipo: meta, acumulado y nº de aportaciones. Se reinicia
-- por semana (week_start = lunes). Requiere 026 (my_team_boss). SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_fund (
  boss_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal         NUMERIC NOT NULL DEFAULT 0,
  accumulated  NUMERIC NOT NULL DEFAULT 0,
  contributors INTEGER NOT NULL DEFAULT 0,
  week_start   DATE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE team_fund ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tf_boss" ON team_fund;
CREATE POLICY "tf_boss" ON team_fund FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

DROP POLICY IF EXISTS "tf_employee_read" ON team_fund;
CREATE POLICY "tf_employee_read" ON team_fund FOR SELECT
  USING (boss_id = my_team_boss());

-- ✅ Listo. Cartocena habilitada.
