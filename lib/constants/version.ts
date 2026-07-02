/**
 * Sello de versión visible en la app.
 * Sirve para confirmar QUÉ build estás viendo en producción.
 * Súbelo cada vez que despliegues cambios grandes.
 */
export const APP_VERSION = 'v7.87'
export const APP_BUILD = '2026-07-02' // v7.87: Checkout de Stripe más directo — submit_type=pay, métodos de pago automáticos (sin fijar payment_method_types) y menos pasos (customer_creation=if_required, billing_address_collection=auto). (Pediste "v7.83" pero ya existía; va como v7.87.)
