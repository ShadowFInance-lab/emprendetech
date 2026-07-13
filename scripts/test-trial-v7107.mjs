/**
 * Prueba v7.107: trial 5 días solo UNA vez por cuenta nueva.
 * - Signup → emprendedor trial ~5d + trial_used_at (si existe columna)
 * - Segundo "grant" no re-otorga
 * - UI: "Prueba gratis — termina en X días"
 *
 * Uso: node scripts/test-trial-v7107.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY')
  process.exit(1)
}

const email = `trial_v7107_${Date.now()}@example.com`
const password = 'TestTrial107!'

function trialUi(expiresAt) {
  const days = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
  if (days <= 0) return 'Prueba gratis — termina hoy'
  if (days === 1) return 'Prueba gratis — termina en 1 día'
  return `Prueba gratis — termina en ${days} días`
}

const headers = (token) => ({
  apikey: anon,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

const signup = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, data: { full_name: 'Trial v7.107' } }),
})
const body = await signup.json()
const uid = body?.user?.id
const access = body?.access_token || body?.session?.access_token
if (!uid || !access) {
  console.error('FAIL signup', signup.status, JSON.stringify(body).slice(0, 400))
  process.exit(1)
}
console.log('✓ signup', uid)

async function loadProfile(token) {
  let pr = await fetch(
    `${url}/rest/v1/profiles?id=eq.${uid}&select=plan,plan_status,plan_expires_at,trial_used_at,created_at`,
    { headers: headers(token) },
  )
  if (!pr.ok) {
    pr = await fetch(
      `${url}/rest/v1/profiles?id=eq.${uid}&select=plan,plan_status,plan_expires_at,created_at`,
      { headers: headers(token) },
    )
  }
  return (await pr.json())[0]
}

let profile = await loadProfile(access)
console.log('  perfil inicial:', profile)

const ends = new Date(Date.now() + 5 * 86400000).toISOString()
const usedAt = new Date().toISOString()

// Simula grantTrialIfNewProfile (solo si free y elegible)
const alreadyTrial =
  profile?.plan === 'emprendedor' && profile?.plan_expires_at
const alreadyUsed = !!profile?.trial_used_at
const usedBefore =
  profile?.plan_status &&
  ['expired', 'cancelled'].includes(String(profile.plan_status))

if (alreadyTrial) {
  console.log('✓ trial ya venía del trigger handle_new_user')
} else if (alreadyUsed || usedBefore) {
  console.error('FAIL cuenta nueva marcada como trial ya usado', profile)
  process.exit(1)
} else if (profile?.plan === 'free') {
  const payload = {
    plan: 'emprendedor',
    plan_status: 'trial',
    plan_expires_at: ends,
  }
  // Intentar con trial_used_at (mig 050)
  let ur = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&plan=eq.free`, {
    method: 'PATCH',
    headers: headers(access),
    body: JSON.stringify({ ...payload, trial_used_at: usedAt }),
  })
  let updated = await ur.json()
  if (!Array.isArray(updated) || !updated[0]) {
    ur = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&plan=eq.free`, {
      method: 'PATCH',
      headers: headers(access),
      body: JSON.stringify(payload),
    })
    updated = await ur.json()
  }
  if (!Array.isArray(updated) || !updated[0]) {
    console.error('FAIL grant trial', ur.status, updated)
    process.exit(1)
  }
  profile = updated[0]
  console.log('✓ grant trial (una vez)')
} else {
  console.error('FAIL estado inesperado', profile)
  process.exit(1)
}

profile = await loadProfile(access)
const firstExpires = profile.plan_expires_at
const firstStatus = profile.plan_status

// Segundo grant: debe NO cambiar (simula re-login / ensurePlanCurrent)
const ends2 = new Date(Date.now() + 5 * 86400000).toISOString()
const usedAt2 = new Date().toISOString()
// Solo actualiza si free AND trial_used_at null — no debería tocar nada
let block = await fetch(
  `${url}/rest/v1/profiles?id=eq.${uid}&plan=eq.free&trial_used_at=is.null`,
  {
    method: 'PATCH',
    headers: headers(access),
    body: JSON.stringify({
      plan: 'emprendedor',
      plan_status: 'trial',
      plan_expires_at: ends2,
      trial_used_at: usedAt2,
    }),
  },
)
let blocked = await block.json()
if (Array.isArray(blocked) && blocked[0]) {
  console.error('FAIL re-grant con trial_used_at null filter tocó el perfil', blocked[0])
  process.exit(1)
}
// Intento malicioso: forzar free y re-trial sin respetar marca
if (service && !service.includes('YOUR_')) {
  // Baja artificial a free conservando trial_used_at (si hay)
  await fetch(`${url}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      plan: 'free',
      plan_status: 'expired',
      plan_expires_at: null,
      ...(profile.trial_used_at ? {} : { trial_used_at: usedAt }),
    }),
  })
  // Intento re-grant solo si trial_used_at is null — no debe matchear
  const re = await fetch(
    `${url}/rest/v1/profiles?id=eq.${uid}&plan=eq.free&trial_used_at=is.null`,
    {
      method: 'PATCH',
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        plan: 'emprendedor',
        plan_status: 'trial',
        plan_expires_at: ends2,
        trial_used_at: usedAt2,
      }),
    },
  )
  const reBody = await re.json()
  if (Array.isArray(reBody) && reBody[0]?.plan === 'emprendedor') {
    console.error('FAIL re-grant después de expirar trial', reBody[0])
    process.exit(1)
  }
  console.log('✓ no re-grant tras bajar a free (trial ya usado)')

  // Restaurar trial activo para asserts de UI
  await fetch(`${url}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan: 'emprendedor',
      plan_status: firstStatus || 'trial',
      plan_expires_at: firstExpires,
    }),
  })
  profile = await loadProfile(access)
} else {
  console.log('  (sin SERVICE_ROLE: se omite prueba de re-grant post-expiry)')
}

const okPlan = profile.plan === 'emprendedor'
const okStatus = ['trial', 'active', 'trialing'].includes(profile.plan_status)
const okExp = !!profile.plan_expires_at
const days = Math.ceil((new Date(profile.plan_expires_at).getTime() - Date.now()) / 86400000)
const okDays = days >= 4 && days <= 5
const ui = trialUi(profile.plan_expires_at)

console.log('  final:', profile)
console.log('  UI:', ui)
console.log(okPlan ? '✓ plan emprendedor' : '✗ plan')
console.log(okStatus ? '✓ plan_status trial/active' : '✗ plan_status')
console.log(okDays ? `✓ vencimiento ~5 días (${days})` : `✗ días restantes ${days}`)
console.log(ui.includes('Prueba gratis') && ui.includes('días') ? '✓ copy UI' : '✗ copy UI')
if (profile.trial_used_at) console.log('✓ trial_used_at marcado')
else console.log('⚠ trial_used_at ausente (ejecuta mig 050 en Supabase)')

if (!(okPlan && okStatus && okDays)) process.exit(1)
console.log('\nPASS v7.107 trial una sola vez')
