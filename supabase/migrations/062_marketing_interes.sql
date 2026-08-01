-- ─── 062: Panel de Interés / Conversiones (solo súper-admin) ────────────────
-- Dos tablas mínimas: visitas anónimas y "leads" de registro a medias.
-- NO se guardan datos sensibles: la IP nunca se almacena, solo un session_id
-- aleatorio generado en el navegador.

-- 1) Visitas a landing / registro de gente NO logueada
CREATE TABLE IF NOT EXISTS page_visits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page       TEXT NOT NULL,               -- 'landing' | 'register'
  session_id TEXT,                        -- aleatorio del navegador (no identifica a nadie)
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_visits_created ON page_visits (created_at DESC);
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
-- Sin políticas públicas: SOLO el service-role (servidor) escribe y lee.
-- Así nadie puede consultar ni manipular estos datos desde el navegador.

-- 2) Registros a medias (empezó el formulario y no terminó)
CREATE TABLE IF NOT EXISTS signup_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT UNIQUE,               -- para actualizar el mismo intento
  email        TEXT,
  step         TEXT,                      -- 'email' | 'password' | 'submit'
  completed    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_signup_leads_created ON signup_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_leads_email ON signup_leads (lower(email));
ALTER TABLE signup_leads ENABLE ROW LEVEL SECURITY;
-- Igual: sin políticas públicas; todo pasa por el servidor con service-role.

-- ✅ Listo. El panel "Interés" de /admin ya puede mostrar datos.
