-- ============================================================================
-- Mercanta Business — Migration 016: Conexiones sociales (tokens OAuth propios)
-- ============================================================================
-- Guarda tokens de redes que NO son proveedores nativos de Supabase (TikTok).
-- Google/Facebook/Instagram usan Supabase Identity Linking (no esta tabla).
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  account_name  TEXT,
  account_id    TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_owner" ON social_connections;
CREATE POLICY "social_owner" ON social_connections FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ✅ Listo. Conexiones sociales habilitadas.
