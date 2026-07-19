/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.116'
export const APP_BUILD = '2026-07-13' // v7.116: "ya está pagado" mitigado (links Stripe caducan en 1 h + guard anti doble-pago de plan que respeta el trial); Google OAuth siempre en dominio canónico (salto desde previews con ?google=1 — adiós localhost); pestañas del modal verificadas.
