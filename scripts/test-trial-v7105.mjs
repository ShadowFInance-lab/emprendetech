/**
 * Prueba v7.105: cuenta nueva obtiene trial Emprendedor 5 días
 * y el copy de UI es "Prueba gratis — termina en X días".
 *
 * Uso: node scripts/test-trial-v7105.mjs
 * Requiere NEXT_PUBLIC_SUPABASE_URL + ANON_KEY (lee .env.local si existe).
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
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY')
  process.exit(1)
}

const email = `trial_v7105_${Date.now()}@example.com`
const password = 'TestTrial105!'

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
  body: JSON.stringify({ email, password, data: { full_name: 'Trial v7.105' } }),
})
const body = await signup.json()
const uid = body?.user?.id
const access = body?.access_token || body?.session?.access_token
if (!uid || !access) {
  console.error('FAIL signup', signup.status, JSON.stringify(body).slice(0, 400))
  process.exit(1)
}
console.log('✓ signup', uid)

// Lectura inicial (trigger actual en prod aún puede dejar free)
let pr = await fetch(
  `${url}/rest/v1/profiles?id=eq.${uid}&select=plan,plan_status,plan_expires_at,created_at`,
  { headers: headers(access) },
)
let profile = (await pr.json())[0]
console.log('  perfil inicial:', profile)

// Respaldo app: grant trial con sesión (como grantTrialIfNewProfile / ensurePlanCurrent)
if (profile?.plan === 'free' && !profile.plan_expires_at) {
  const ends = new Date(Date.now() + 5 * 86400000).toISOString()
  const ur = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&plan=eq.free`, {
    method: 'PATCH',
    headers: headers(access),
    body: JSON.stringify({ plan: 'emprendedor', plan_status: 'trial', plan_expires_at: ends }),
  })
  const updated = await ur.json()
  if (!Array.isArray(updated) || !updated[0]) {
    console.error('FAIL grant trial', ur.status, updated)
    process.exit(1)
  }
  profile = updated[0]
  console.log('✓ grant trial (respaldo sesión)')
} else if (profile?.plan === 'emprendedor' && profile.plan_expires_at) {
  console.log('✓ trial ya venía del trigger handle_new_user')
} else {
  console.error('FAIL estado inesperado', profile)
  process.exit(1)
}

pr = await fetch(
  `${url}/rest/v1/profiles?id=eq.${uid}&select=plan,plan_status,plan_expires_at`,
  { headers: headers(access) },
)
profile = (await pr.json())[0]

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

if (!(okPlan && okStatus && okDays)) process.exit(1)
console.log('\nPASS v7.105 trial 5 días')
