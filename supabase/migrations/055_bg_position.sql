-- ─── 055: Posición manual del fondo del catálogo ────────────────────────────
-- Permite mover la imagen de fondo (arriba/centro/abajo · izquierda/derecha).
-- Valor tipo CSS background-position (ej. 'center', 'top left', '50% 30%').
ALTER TABLE stores ADD COLUMN IF NOT EXISTS bg_position TEXT;
