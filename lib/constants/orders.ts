// Estados de un pedido online. En un módulo NORMAL (no 'use server') para poder
// importar el VALOR en componentes cliente — los 'use server' solo exponen
// funciones async al cliente, así que un `const` exportado desde ahí llega
// `undefined` y rompe el render (spread de undefined).
export const ORDER_STATUSES = ['pendiente', 'confirmado', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]
