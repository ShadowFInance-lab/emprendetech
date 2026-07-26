-- ─── 058: Contraseña de acceso del empleado visible para el jefe ────────────
-- El jefe necesita poder consultar la contraseña del POS de su empleado (se la
-- comparte cuando la olvida). Como el hash de auth.users es irreversible, se
-- guarda aquí una copia legible.
--
-- ⚠️ NOTA DE SEGURIDAD: esta columna guarda la contraseña en TEXTO PLANO. Solo
-- sirve para el acceso al POS del negocio y únicamente la lee el jefe dueño del
-- empleado (RLS meta_boss + verificación de propiedad en el servidor). NO uses
-- aquí contraseñas personales ni reutilizadas de otros servicios.
ALTER TABLE employee_meta ADD COLUMN IF NOT EXISTS login_password TEXT;
