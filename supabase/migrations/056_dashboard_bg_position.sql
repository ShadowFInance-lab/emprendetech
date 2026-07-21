-- ─── 056: Posición manual del fondo del panel admin ─────────────────────────
-- Igual que bg_position del catálogo, pero para el fondo del dashboard/panel.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS dashboard_bg_position TEXT;
