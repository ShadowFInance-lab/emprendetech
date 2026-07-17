'use server'

import { createPublicClient } from '@/lib/supabase/server'

/**
 * Reseñas de productos del catálogo público: estrellas (1-5) + comentario.
 * Los compradores NO necesitan cuenta (cliente anon + RLS de inserción pública).
 * Moderación: el filtro de palabras vulgares corre AQUÍ (servidor) — el cliente
 * no puede saltárselo. Si el texto contiene vulgaridades, la reseña se rechaza.
 */

export interface ProductReview {
  id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
}

// Lista de vulgaridades comunes (es-MX). Se compara contra el texto normalizado
// (sin acentos y con números-letra convertidos: p3ndejo → pendejo).
const BAD_WORDS = new Set([
  'puto', 'puta', 'putos', 'putas', 'putita', 'putito',
  'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada', 'pendejadas',
  'chinga', 'chingar', 'chingada', 'chingado', 'chingados', 'chingadas', 'chingón', 'chingon', 'chingue', 'chinguen',
  'verga', 'vergas', 'vrga', 'vergazo',
  'mierda', 'mierdas', 'miarda',
  'culero', 'culera', 'culeros', 'culeras', 'culo', 'culos', 'ojete', 'ojetes',
  'cabron', 'cabrona', 'cabrones', 'cabronas',
  'mamon', 'mamona', 'mamones', 'mamada', 'mamadas',
  'joto', 'jota', 'jotos', 'jotas', 'marica', 'maricon', 'maricones', 'maricas',
  'pinche', 'pinches',
  'estupido', 'estupida', 'estupidos', 'estupidas', 'imbecil', 'imbeciles', 'idiota', 'idiotas',
  'zorra', 'zorras', 'perra', 'perras',
  'carajo', 'cono', 'joder', 'jodido', 'jodida', 'jodete',
  'cagada', 'cagadas', 'cagado', 'cagar',
  'pito', 'pitos', 'polla', 'pollas', 'follar', 'follada',
  'teta', 'tetas', 'nalga', 'nalgas',
  'wey', 'guey', 'naco', 'nacos', 'naca', 'nacas',
])

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
}

function hasProfanity(text: string): boolean {
  const words = normalize(text).split(/[^a-zñ]+/)
  return words.some(w => w && BAD_WORDS.has(w))
}

/** Publica una reseña (rechaza texto vulgar). No requiere cuenta. */
export async function submitReviewAction(input: {
  product_id: string
  store_id: string
  name: string
  rating: number
  comment?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const name = (input.name || '').trim().slice(0, 60)
    const comment = (input.comment || '').trim().slice(0, 500)
    const rating = Math.round(Number(input.rating))

    if (name.length < 2) return { success: false, error: 'Escribe tu nombre.' }
    if (!(rating >= 1 && rating <= 5)) return { success: false, error: 'Elige de 1 a 5 estrellas.' }
    if (hasProfanity(name) || hasProfanity(comment)) {
      return { success: false, error: 'Tu comentario contiene palabras no permitidas. Modifícalo e intenta de nuevo.' }
    }

    const supabase = createPublicClient()
    const { error } = await supabase.from('product_reviews').insert({
      product_id: input.product_id,
      store_id: input.store_id,
      reviewer_name: name,
      rating,
      comment: comment || null,
    })
    if (error) return { success: false, error: 'No se pudo publicar la reseña. (¿Migración 052 aplicada?)' }
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo publicar la reseña.' }
  }
}

/** Reseñas de un producto: promedio, total y las más recientes. */
export async function getProductReviews(productId: string): Promise<{
  avg: number
  count: number
  items: ProductReview[]
}> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, reviewer_name, rating, comment, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return { avg: 0, count: 0, items: [] }
    const items = data as ProductReview[]
    const count = items.length
    const avg = count ? Math.round((items.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0
    return { avg, count, items }
  } catch {
    return { avg: 0, count: 0, items: [] }
  }
}
