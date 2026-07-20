/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.121'
export const APP_BUILD = '2026-07-20' // v7.121: AUDITORÍA Google Login + Stripe. FIX real: SocialAuthButtons usaba NEXT_PUBLIC_APP_URL en crudo para el salto canónico → si esa env era localhost en Vercel, mandaba a los usuarios de prod a localhost:3000 (rompía Google + "aparece localhost"); ahora usa getAppUrl(). Nuevo endpoint /api/diag: ping REAL a Stripe con la llave, detecta si APP_URL es localhost y qué variables faltan, sin exponer secretos. Confirmado por grep: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no se usa (checkout hospedado con llave secreta).
