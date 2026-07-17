'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Star, Loader2, Send } from 'lucide-react'
import { getProductReviews, submitReviewAction, type ProductReview } from '@/lib/actions/reviews'

interface Props {
  productId: string
  storeId: string
  primary: string
  isMinimalista?: boolean
}

function Stars({ value, size = 16, onSelect, hover, onHover }: {
  value: number
  size?: number
  onSelect?: (n: number) => void
  hover?: number
  onHover?: (n: number) => void
}) {
  const active = hover || value
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => onHover?.(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(n)}
          onMouseEnter={() => onHover?.(n)}
          className={onSelect ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
          aria-label={`${n} estrellas`}
        >
          <Star
            size={size}
            className={n <= active ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  )
}

export default function ProductReviews({ productId, storeId, primary, isMinimalista = false }: Props) {
  const [items, setItems] = useState<ProductReview[]>([])
  const [avg, setAvg] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Formulario
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  async function load() {
    const r = await getProductReviews(productId)
    setItems(r.items); setAvg(r.avg); setCount(r.count); setLoading(false)
  }
  useEffect(() => { load() }, [productId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (rating < 1) { toast.error('Elige de 1 a 5 estrellas'); return }
    if (name.trim().length < 2) { toast.error('Escribe tu nombre'); return }
    setSending(true)
    const res = await submitReviewAction({ product_id: productId, store_id: storeId, name, rating, comment })
    setSending(false)
    if (res.success) {
      toast.success('¡Gracias por tu opinión!')
      setName(''); setRating(0); setComment('')
      load()
    } else {
      toast.error(res.error ?? 'No se pudo publicar')
    }
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <section className="mt-16 font-sans">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
        <h2 className={`text-xl font-bold ${isMinimalista ? 'font-serif' : ''}`}>Opiniones</h2>
        {count > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={Math.round(avg)} />
            <span className="text-sm text-gray-600 font-semibold">{avg}</span>
            <span className="text-xs text-gray-400">({count} opinión{count === 1 ? '' : 'es'})</span>
          </div>
        )}
      </div>

      {/* Escribir reseña */}
      <div className={`border border-gray-100 p-4 mb-6 bg-white ${isMinimalista ? '' : 'rounded-2xl shadow-sm'}`}>
        <p className="text-sm font-semibold text-gray-800 mb-2.5">Califica este producto</p>
        <div className="mb-3"><Stars value={rating} size={26} onSelect={setRating} hover={hover} onHover={setHover} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr_auto] gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={60}
            className={`h-10 px-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 ${isMinimalista ? '' : 'rounded-xl'}`}
          />
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Escribe tu opinión (opcional)"
            maxLength={500}
            className={`h-10 px-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 ${isMinimalista ? '' : 'rounded-xl'}`}
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className={`h-10 px-4 text-sm font-bold text-white inline-flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50 ${isMinimalista ? '' : 'rounded-xl'}`}
            style={{ backgroundColor: primary }}
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publicar
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Los comentarios con lenguaje ofensivo se rechazan automáticamente.</p>
      </div>

      {/* Lista de reseñas */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Aún no hay opiniones. ¡Sé la primera persona en calificar!</p>
      ) : (
        <div className="space-y-3">
          {items.map(r => (
            <div key={r.id} className={`border border-gray-100 bg-white p-3.5 ${isMinimalista ? '' : 'rounded-xl'}`}>
              <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: primary }}
                  >
                    {r.reviewer_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{r.reviewer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} size={13} />
                  <span className="text-[11px] text-gray-400">{fmtDate(r.created_at)}</span>
                </div>
              </div>
              {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
