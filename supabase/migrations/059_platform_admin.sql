-- ─── 059: Súper-admin de la PLATAFORMA (consola /admin) ─────────────────────
-- Marca qué usuario puede entrar a la Consola de Admin de Mercanta (la que
-- controla TODA la plataforma, no el panel de una tienda).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- Marca a tu usuario como súper-admin (cambia el correo por el tuyo):
-- UPDATE profiles SET is_platform_admin = true
--  WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('TU_CORREO'));

-- Comprobar:
-- SELECT u.email, p.is_platform_admin FROM profiles p
--   JOIN auth.users u ON u.id = p.id WHERE p.is_platform_admin;
