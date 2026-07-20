/**
 * URL base ABSOLUTA de la app — SEGURA PARA PRODUCCIÓN.
 *
 * Regla de oro: NUNCA devolver localhost en producción.
 *
 * Causa raíz del bug "me manda a localhost:3000" al confirmar la cuenta o al
 * pagar: la variable NEXT_PUBLIC_APP_URL quedó con el valor de desarrollo
 * (http://localhost:3000, tal cual el .env.example) también en Vercel, y ese
 * valor se usaba SIN filtrar en los redirects de Supabase (emailRedirectTo,
 * reset de contraseña, OAuth) y en las success_url / cancel_url de Stripe.
 * Resultado: en producción los correos y los checkouts apuntaban a localhost.
 *
 * Este helper centraliza la lógica y descarta cualquier valor local.
 *
 * Prioridad:
 *   1. NEXT_PUBLIC_APP_URL  — solo si es https y NO es localhost/loopback.
 *   2. VERCEL_URL           — dominio real del deploy (solo en el servidor).
 *   3. Dominio de producción por defecto.
 *
 * Nota: en componentes de cliente `process.env.VERCEL_URL` no existe (no es
 * NEXT_PUBLIC_), así que ahí se cae al paso 1 o al 3 — igual nunca localhost.
 */
const PROD_FALLBACK = 'https://emprendetech.vercel.app'
const LOCAL_RE = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i

function clean(u: string): string {
  return u.replace(/\/+$/, '')
}

export function getAppUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env && /^https:\/\//i.test(env) && !LOCAL_RE.test(env)) return clean(env)

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel && !LOCAL_RE.test(vercel)) {
    return clean(`https://${vercel.replace(/^https?:\/\//i, '')}`)
  }
  return PROD_FALLBACK
}
