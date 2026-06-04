/**
 * Genera un slug URL-friendly desde un texto.
 * Ej: "Playera Básica" → "playera-basica"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')                       // Descomponer tildes
    .replace(/[̀-ͯ]/g, '')        // Eliminar diacríticos
    .replace(/[^a-z0-9\s-]/g, '')           // Solo alfanumérico y guión
    .trim()
    .replace(/\s+/g, '-')                   // Espacios → guión
    .replace(/-+/g, '-')                    // Guiones múltiples → uno
    .slice(0, 80)                           // Máximo 80 caracteres
}

/**
 * Asegura que el slug sea único agregando un sufijo numérico si es necesario.
 * Debe usarse con una comprobación en la DB.
 */
export function generateUniqueSlug(base: string, suffix: number): string {
  if (suffix === 0) return generateSlug(base)
  return `${generateSlug(base)}-${suffix}`
}
