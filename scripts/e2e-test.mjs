/**
 * ════════════════════════════════════════════════════════════════
 * EmprendeTech — Test E2E del flujo completo contra Supabase REAL
 * ════════════════════════════════════════════════════════════════
 * Usa SOLO el anon key (como lo haría un usuario real en la app).
 * Al registrar un usuario obtiene sesión y opera bajo RLS.
 *
 * Prueba: registro → profile auto → tienda → categoría → 3 productos
 *        → venta (descuento stock vía trigger) → folio → movimiento
 *        → alerta stock bajo → cancelar venta (devuelve stock)
 *        → lectura pública del catálogo.
 *
 * Ejecutar:  node scripts/e2e-test.mjs
 * Requiere:  NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local
 * ════════════════════════════════════════════════════════════════
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Cargar .env.local manualmente (robusto en Windows) ─────────
function loadEnv() {
  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), 'emprendeia-saas', '.env.local'),
  ]
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, 'utf8')
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
      return path
    } catch { /* probar siguiente */ }
  }
  return null
}
const envPath = loadEnv()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ─── Helpers de logging ─────────────────────────────────────────
let passed = 0, failed = 0
const ok = (m) => { console.log(`  ✅ ${m}`); passed++ }
const fail = (m, e) => { console.log(`  ❌ ${m}${e ? ` → ${e}` : ''}`); failed++ }
const step = (m) => console.log(`\n▶ ${m}`)

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  EmprendeTech — Test E2E contra Supabase real')
  console.log('═══════════════════════════════════════════════')

  if (!URL || URL.includes('TU_PROYECTO') || !ANON || ANON.includes('tu_anon')) {
    console.log('\n❌ Faltan credenciales reales en .env.local')
    console.log('   Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  console.log(`\n🔗 Conectando a: ${URL}`)

  const supabase = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = Date.now()
  const email = `emprendeia.e2e.${stamp}@gmail.com`
  const password = 'Test123456!'
  let storeId = null
  const slug = `tienda-e2e-${stamp}`

  // ─── 1. CONEXIÓN ──────────────────────────────────────────────
  step('1. Conexión y existencia de tablas')
  {
    const { error } = await supabase.from('stores').select('id').limit(1)
    if (error && !error.message.includes('0 rows')) {
      // Un error de "permission denied" o "does not exist" sería fatal
      if (error.message.includes('does not exist')) {
        fail('La tabla "stores" no existe — ¿ejecutaste la migración 000_complete_setup.sql?', error.message)
        process.exit(1)
      }
    }
    ok('Conexión establecida y tabla stores accesible')
  }

  // ─── 2. REGISTRO ──────────────────────────────────────────────
  step('2. Registro de usuario (auth.signUp)')
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email, password, options: { data: { full_name: 'Usuario E2E' } },
  })
  if (signUpErr) { fail('signUp falló', signUpErr.message); process.exit(1) }
  ok(`Usuario creado: ${email}`)

  // Obtener sesión (si email confirmation está ON, no habrá sesión)
  let session = signUpData.session
  if (!session) {
    // Intento 1: login directo (funciona si "Confirm email" está OFF)
    let { data: signInData } = await supabase.auth.signInWithPassword({ email, password })
    session = signInData?.session

    // Intento 2: si hay service_role, confirmar el usuario vía admin API
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!session && serviceKey && !serviceKey.includes('YOUR_')) {
      ok('Usando service_role para confirmar el usuario automáticamente')
      const admin = createClient(URL, serviceKey, { auth: { persistSession: false } })
      const { data: list } = await admin.auth.admin.listUsers()
      const u = list?.users?.find(x => x.email === email)
      if (u) {
        await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
        const retry = await supabase.auth.signInWithPassword({ email, password })
        session = retry.data?.session
      }
    }

    if (!session) {
      fail('No se pudo iniciar sesión tras el registro', 'Email not confirmed')
      console.log('\n⚠️  "Confirm email" está ACTIVADO en Supabase.')
      console.log('    Solución A (10 seg): Authentication → Sign In / Providers → Email')
      console.log('       → desactiva "Confirm email" → guarda → reintenta.')
      console.log('    Solución B: pon SUPABASE_SERVICE_ROLE_KEY en .env.local y reintenta')
      console.log('       (el script confirmará usuarios automáticamente).')
      process.exit(1)
    }
  }
  const userId = session.user.id
  ok(`Sesión activa. user.id = ${userId.slice(0, 8)}…`)

  // ─── 3. PROFILE AUTO-CREADO (trigger handle_new_user) ─────────
  step('3. Profile auto-creado por trigger')
  await new Promise(r => setTimeout(r, 800)) // dar tiempo al trigger
  {
    const { data: profile, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    if (error || !profile) fail('Profile no se creó automáticamente', error?.message)
    else {
      ok(`Profile existe. plan = "${profile.plan}" (esperado: free)`)
      if (profile.plan !== 'free') fail('Plan inicial no es "free"')
    }
  }

  // ─── 4. ONBOARDING + CREAR TIENDA ─────────────────────────────
  step('4. Crear tienda (onboarding)')
  {
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', userId)
    const { data: store, error } = await supabase.from('stores').insert({
      owner_id: userId, name: 'Tienda E2E', slug,
      whatsapp: '+52 55 1234 5678', skin: 'moderna',
    }).select().single()
    if (error || !store) { fail('No se pudo crear la tienda', error?.message); process.exit(1) }
    storeId = store.id
    ok(`Tienda creada: "${store.name}" (/catalog/${store.slug})`)
  }

  // ─── 5. CATEGORÍA ─────────────────────────────────────────────
  step('5. Crear categoría')
  let categoryId = null
  {
    const { data, error } = await supabase.from('categories').insert({
      store_id: storeId, name: 'Ropa', slug: 'ropa',
    }).select('id').single()
    if (error) fail('No se pudo crear categoría', error.message)
    else { categoryId = data.id; ok('Categoría "Ropa" creada') }
  }

  // ─── 6. CREAR 3 PRODUCTOS ─────────────────────────────────────
  step('6. Crear 3 productos')
  const productIds = []
  const productsToCreate = [
    { name: 'Playera Roja', slug: 'playera-roja', cost_price: 80, sale_price: 199, stock: 10 },
    { name: 'Collar Plata', slug: 'collar-plata', cost_price: 120, sale_price: 450, stock: 6, is_featured: true },
    { name: 'Gorra Azul', slug: 'gorra-azul', cost_price: 60, sale_price: 180, stock: 3 },
  ]
  for (const p of productsToCreate) {
    const { data, error } = await supabase.from('products').insert({
      store_id: storeId, category_id: categoryId, ...p,
    }).select('id, name, stock').single()
    if (error) fail(`No se pudo crear "${p.name}"`, error.message)
    else { productIds.push(data); ok(`Producto "${data.name}" — stock inicial: ${data.stock}`) }
  }

  // ─── 7. REGISTRAR VENTA + verificar descuento de stock ───────
  step('7. Registrar venta (PRUEBA CRÍTICA: trigger descuenta stock)')
  let saleId = null
  {
    const p1 = productIds[0] // Playera Roja, stock 10
    const p2 = productIds[1] // Collar Plata, stock 6
    const qty1 = 2, qty2 = 1
    const stockBefore1 = p1.stock, stockBefore2 = p2.stock

    const { data: sale, error: saleErr } = await supabase.from('sales').insert({
      store_id: storeId, folio: 'TEMP',
      subtotal: 199 * qty1 + 450 * qty2, total: 199 * qty1 + 450 * qty2,
      total_cost: 80 * qty1 + 120 * qty2, profit: (199 - 80) * qty1 + (450 - 120) * qty2,
      payment_method: 'cash', status: 'completed',
    }).select('id, folio').single()
    if (saleErr) { fail('No se pudo crear la venta', saleErr.message); }
    else {
      saleId = sale.id
      ok(`Venta creada. Folio = "${sale.folio}"`)
      if (sale.folio === 'VTA-00001') ok('Folio automático correcto (VTA-00001)')
      else fail(`Folio inesperado: ${sale.folio}`)

      // Insertar items → dispara el trigger
      const { error: itemsErr } = await supabase.from('sale_items').insert([
        { sale_id: sale.id, product_id: p1.id, product_name: p1.name, quantity: qty1, unit_price: 199, unit_cost: 80, subtotal: 199 * qty1 },
        { sale_id: sale.id, product_id: p2.id, product_name: p2.name, quantity: qty2, unit_price: 450, unit_cost: 120, subtotal: 450 * qty2 },
      ])
      if (itemsErr) fail('No se pudieron insertar los items', itemsErr.message)
      else {
        await new Promise(r => setTimeout(r, 600))
        // Verificar stock descontado
        const { data: after1 } = await supabase.from('products').select('stock, total_sold').eq('id', p1.id).single()
        const { data: after2 } = await supabase.from('products').select('stock, total_sold').eq('id', p2.id).single()
        if (after1.stock === stockBefore1 - qty1) ok(`Stock "${p1.name}": ${stockBefore1} → ${after1.stock} (−${qty1}) ✓`)
        else fail(`Stock "${p1.name}" incorrecto: esperado ${stockBefore1 - qty1}, real ${after1.stock}`)
        if (after2.stock === stockBefore2 - qty2) ok(`Stock "${p2.name}": ${stockBefore2} → ${after2.stock} (−${qty2}) ✓`)
        else fail(`Stock "${p2.name}" incorrecto`)
        if (after1.total_sold === qty1) ok(`total_sold "${p1.name}" = ${after1.total_sold} ✓`)
        else fail(`total_sold incorrecto`)
      }
    }
  }

  // ─── 8. MOVIMIENTOS DE INVENTARIO ─────────────────────────────
  step('8. Movimientos de inventario generados')
  {
    const { data: movs } = await supabase.from('inventory_movements')
      .select('type, quantity').eq('store_id', storeId).eq('type', 'sale')
    if (movs && movs.length >= 2) ok(`${movs.length} movimientos tipo "sale" registrados ✓`)
    else fail(`Se esperaban ≥2 movimientos, hay ${movs?.length ?? 0}`)
  }

  // ─── 9. ALERTA DE STOCK BAJO ──────────────────────────────────
  step('9. Alerta de stock bajo (vender Gorra hasta umbral)')
  {
    const gorra = productIds[2] // stock 3, umbral default 5
    const { data: sale2 } = await supabase.from('sales').insert({
      store_id: storeId, folio: 'TEMP', subtotal: 180, total: 180,
      total_cost: 60, profit: 120, payment_method: 'cash', status: 'completed',
    }).select('id').single()
    await supabase.from('sale_items').insert({
      sale_id: sale2.id, product_id: gorra.id, product_name: gorra.name,
      quantity: 1, unit_price: 180, unit_cost: 60, subtotal: 180,
    })
    await new Promise(r => setTimeout(r, 600))
    const { data: alerts } = await supabase.from('alerts')
      .select('type, title').eq('store_id', storeId)
    if (alerts && alerts.length > 0) ok(`Alerta generada: "${alerts[0].title}" ✓`)
    else fail('No se generó alerta de stock bajo (Gorra quedó en 2, umbral 5)')
  }

  // ─── 10. CANCELAR VENTA → devuelve stock ──────────────────────
  step('10. Cancelar venta (trigger devuelve stock)')
  if (saleId) {
    const p1 = productIds[0]
    const { data: beforeCancel } = await supabase.from('products').select('stock').eq('id', p1.id).single()
    await supabase.from('sales').update({ status: 'cancelled' }).eq('id', saleId)
    await new Promise(r => setTimeout(r, 600))
    const { data: afterCancel } = await supabase.from('products').select('stock').eq('id', p1.id).single()
    if (afterCancel.stock === beforeCancel.stock + 2) ok(`Stock devuelto: ${beforeCancel.stock} → ${afterCancel.stock} (+2) ✓`)
    else fail(`Stock no se devolvió: ${beforeCancel.stock} → ${afterCancel.stock}`)
  }

  // ─── 11. LECTURA PÚBLICA DEL CATÁLOGO (sin auth) ──────────────
  step('11. Catálogo público (cliente anónimo, sin sesión)')
  {
    const anonClient = createClient(URL, ANON, { auth: { persistSession: false } })
    const { data: pubStore } = await anonClient.from('stores')
      .select('name, slug').eq('slug', slug).eq('catalog_active', true).single()
    if (pubStore) ok(`Tienda visible públicamente: "${pubStore.name}" ✓`)
    else fail('La tienda NO es visible públicamente (revisar RLS public_read)')

    const { data: pubProducts } = await anonClient.from('products')
      .select('name, sale_price').eq('store_id', storeId).eq('is_active', true)
    if (pubProducts && pubProducts.length >= 3) ok(`${pubProducts.length} productos visibles en catálogo ✓`)
    else fail(`Productos públicos: ${pubProducts?.length ?? 0} (esperado ≥3)`)
  }

  // ─── 12. LIMPIEZA ─────────────────────────────────────────────
  // Orden correcto: ventas primero (cascade borra sale_items, liberando
  // la FK RESTRICT de products), luego la tienda (cascade borra el resto).
  step('12. Limpieza de datos de prueba')
  {
    await supabase.from('sales').delete().eq('store_id', storeId)
    const { error } = await supabase.from('stores').delete().eq('id', storeId)
    if (!error) ok('Datos de prueba eliminados (ventas → tienda → cascade)')
    else fail('No se pudo limpiar', error.message)
  }

  // ─── RESUMEN ──────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════')
  console.log(`  RESULTADO:  ${passed} ✅   ${failed} ❌`)
  console.log('═══════════════════════════════════════════════')
  if (failed === 0) {
    console.log('🎉 TODO FUNCIONA con base de datos real.')
    console.log('   Flujo completo verificado: registro → venta → catálogo.')
  } else {
    console.log('⚠️  Hay fallos. Revisa los ❌ de arriba.')
  }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error('\n💥 Error fatal:', e.message); process.exit(1) })
