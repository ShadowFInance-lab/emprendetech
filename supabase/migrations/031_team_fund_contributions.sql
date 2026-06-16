-- ============================================================================
-- Mercanta Business — Migration 031: Cartocena con aportes por empleado
-- ============================================================================
-- Aportes semanales al fondo del equipo. El acumulado y nº de aportantes se
-- derivan de esta tabla (semana = lunes). La meta vive en team_fund. SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_fund_contributions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contributor TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  week_start  DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE team_fund_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tfc_boss" ON team_fund_contributions;
CREATE POLICY "tfc_boss" ON team_fund_contributions FOR ALL
  USING (boss_id = auth.uid()) WITH CHECK (boss_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tfc_boss_week ON team_fund_contributions(boss_id, week_start);

-- ✅ Listo. Aportes de Cartocena habilitados.
