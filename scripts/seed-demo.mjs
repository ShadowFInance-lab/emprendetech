/**
 * ════════════════════════════════════════════════════════════════
 * EmprendeTech — Sembrar tienda DEMO en Supabase real
 * ════════════════════════════════════════════════════════════════
 * Crea una tienda "Boutique Luna" con categorías, productos e imágenes
 * (URLs externas de picsum.photos) para ver el catálogo en vivo.
 *
 * Idempotente: si la tienda demo ya existe, la borra y la recrea.
 * Ejecutar:  node scripts/seed-demo.mjs
 * ════════════════════════════════════════════════════════════════
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  for (const path of [resolve(process.cwd(), '.env.local')]) {
    try {
      const raw = readFileSync(path, 'utf8')
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch {}
  }
}
loadEnv()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SLUG = 'boutique-luna'
const DEMO_EMAIL = 'demo.boutiqueluna@gmail.com'
const DEMO_PASS = 'DemoLuna2026!'

const img = (seed) => `https://picsum.photos/seed/${seed}/800/800`

async function main() {
  console.log('🌱 Sembrando tienda demo en', URL, '\n')
  const sb = createClient(URL, ANON, { auth: { persistSession: false } })

  // ─── Auth: crear o iniciar sesión ───────────────────────────
  let session
  const up = await sb.auth.signUp({
    email: DEMO_EMAIL, password: DEMO_PASS,
    options: { data: { full_name: 'Boutique Luna' } },
  })
  session = up.data.session
  if (!session) {
    const si = await sb.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASS })
    if (si.error) { console.error('❌ No se pudo autenticar el usuario demo:', si.error.message); process.exit(1) }
    session = si.data.session
  }
  const userId = session.user.id
  console.log('✅ Usuario demo autenticado:', DEMO_EMAIL)

  await sb.from('profiles').update({ onboarding_done: true }).eq('id', userId)

  // ─── Limpiar tienda previa con ese slug (reseed limpio) ─────
  const { data: existing } = await sb.from('stores').select('id').eq('slug', SLUG).maybeSingle?.() ?? { data: null }
  if (existing?.id) {
    await sb.from('sales').delete().eq('store_id', existing.id)
    await sb.from('stores').delete().eq('id', existing.id)
    console.log('🧹 Tienda demo previa eliminada para recrear')
  }

  // ─── Crear tienda con branding ──────────────────────────────
  const { data: store, error: storeErr } = await sb.from('stores').insert({
    owner_id: userId,
    name: 'Boutique Luna',
    slug: SLUG,
    tagline: 'Joyería artesanal en plata',
    description: 'Piezas únicas hechas a mano en plata .925. Envíos a todo México. Escríbenos por WhatsApp para apartar la tuya.',
    whatsapp: '+52 55 1234 5678',
    instagram: 'https://instagram.com/boutiqueluna',
    facebook: 'https://facebook.com/boutiqueluna',
    skin: 'moderna',
    primary_color: '#7C3AED',
    secondary_color: '#5B21B6',
    button_color: '#059669',
    banner_url: img('boutique-banner-luna'),
    logo_url: img('boutique-logo-luna'),
    product_order: 'featured',
  }).select().single()
  if (storeErr) { console.error('❌ Error creando tienda:', storeErr.message); process.exit(1) }
  console.log('✅ Tienda creada:', store.name)

  // ─── Categorías ─────────────────────────────────────────────
  const cats = {}
  for (const [name, slug] of [['Collares', 'collares'], ['Aretes', 'aretes'], ['Pulseras', 'pulseras'], ['Anillos', 'anillos']]) {
    const { data } = await sb.from('categories').insert({ store_id: store.id, name, slug }).select('id').single()
    cats[slug] = data.id
  }
  console.log('✅ 4 categorías creadas')

  // ─── Productos ──────────────────────────────────────────────
  const products = [
    { name: 'Collar Luna Creciente', cat: 'collares', cost: 120, price: 450, stock: 15, featured: true, imgs: 2 },
    { name: 'Collar Perla Barroca', cat: 'collares', cost: 180, price: 620, stock: 8, featured: true, imgs: 2 },
    { name: 'Aretes Gota de Plata', cat: 'aretes', cost: 90, price: 280, stock: 22, new: true, imgs: 1 },
    { name: 'Aretes Argolla Texturizada', cat: 'aretes', cost: 75, price: 240, stock: 18, imgs: 1 },
    { name: 'Pulsera Charms Personalizable', cat: 'pulseras', cost: 110, price: 380, stock: 12, featured: true, imgs: 2 },
    { name: 'Pulsera Tejido Milanés', cat: 'pulseras', cost: 95, price: 320, stock: 4, imgs: 1 },
    { name: 'Anillo Ajustable Martillado', cat: 'anillos', cost: 70, price: 230, stock: 25, new: true, imgs: 1 },
    { name: 'Anillo Solitario Circón', cat: 'anillos', cost: 140, price: 520, stock: 2, imgs: 2 },
    { name: 'Collar Inicial Personalizado', cat: 'collares', cost: 100, price: 390, stock: 0, imgs: 1 }, // agotado
  ]

  let n = 0
  for (const p of products) {
    const slug = p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    const { data: prod, error } = await sb.from('products').insert({
      store_id: store.id, category_id: cats[p.cat], name: p.name, slug,
      description: `${p.name} — pieza artesanal en plata .925. Acabado pulido a mano. Incluye estuche de regalo.`,
      sku: `BL-${(n + 1).toString().padStart(3, '0')}`,
      cost_price: p.cost, sale_price: p.price, stock: p.stock,
      is_featured: !!p.featured, is_new: !!p.new,
    }).select('id').single()
    if (error) { console.error(`  ❌ ${p.name}:`, error.message); continue }

    // Imágenes
    const images = []
    for (let i = 0; i < p.imgs; i++) {
      images.push({
        product_id: prod.id,
        url: img(`${slug}-${i}`),
        is_primary: i === 0,
        sort_order: i,
      })
    }
    await sb.from('product_images').insert(images)
    n++
    console.log(`  ✅ ${p.name} (${p.imgs} foto${p.imgs > 1 ? 's' : ''}, stock ${p.stock})`)
  }

  console.log(`\n🎉 LISTO. ${n} productos creados.`)
  console.log('═══════════════════════════════════════════════')
  console.log(`  Catálogo:  /catalog/${SLUG}`)
  console.log(`  Local:     http://localhost:3000/catalog/${SLUG}`)
  console.log('═══════════════════════════════════════════════')
  console.log('\n  Login del dueño (para ver el dashboard):')
  console.log(`  Email: ${DEMO_EMAIL}`)
  console.log(`  Pass:  ${DEMO_PASS}`)
}

main().catch(e => { console.error('💥', e.message); process.exit(1) })
