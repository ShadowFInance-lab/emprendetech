/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.117'
export const APP_BUILD = '2026-07-13' // v7.117: el comprador PAGA con Stripe al finalizar el pedido (checkout con destination charge + comisión por plan) y el webhook lo marca "Pagado" solo; checkout 100% Tarjeta con Stripe (cero menciones a contra entrega/transferencia); pestañas y OAuth canónico verificados.
