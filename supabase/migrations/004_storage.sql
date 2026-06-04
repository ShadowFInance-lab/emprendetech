-- ============================================================
-- EmprendeIA SaaS — Migration 004: Storage bucket + políticas
-- ============================================================
-- Ejecutar DESPUÉS de crear el bucket "public-assets" en el dashboard
-- de Supabase (Storage → New bucket → name: public-assets → Public: ON)

-- ─── POLÍTICAS DE STORAGE ───────────────────────────────────
-- Lectura pública (para mostrar imágenes en el catálogo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permitir a usuarios autenticados subir archivos
CREATE POLICY "authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public-assets');

-- Permitir a usuarios autenticados actualizar sus archivos
CREATE POLICY "authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'public-assets');

-- Permitir a usuarios autenticados eliminar archivos
CREATE POLICY "authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'public-assets');

-- Lectura pública de todos los archivos del bucket
CREATE POLICY "public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'public-assets');
