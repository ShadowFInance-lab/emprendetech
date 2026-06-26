import type { Plan } from '@/lib/types'

export const PLAN_LIMITS: Record<Plan, {
  max_products: number
  max_categories: number
  max_images_per_product: number
  skins: string[]
  can_export_pdf: boolean
  can_export_excel: boolean
  show_ads: boolean
  label: string
  price_monthly: number | null
  price_label: string
  // VIP Plus: cobro medido por venta con Mercado Pago
  included_sales_per_month?: number   // ventas MP incluidas/mes
  extra_sale_fee?: number             // costo por venta adicional (MXN)
}> = {
  free: {
    max_products: Infinity,
    max_categories: Infinity,
    max_images_per_product: 20,
    skins: ['moderna', 'minimalista'],
    can_export_pdf: true,
    can_export_excel: true,
    show_ads: false,
    label: 'Gratis (Modo Completo)',
    price_monthly: null,
    price_label: 'Gratis',
  },
  emprendedor: {
    max_products: 5000,
    max_categories: 100,
    max_images_per_product: 10,
    skins: ['moderna', 'minimalista'],
    can_export_pdf: true,
    can_export_excel: true,
    show_ads: false,
    label: 'Emprendedor',
    price_monthly: 199,
    price_label: '$199 MXN/mes',
  },
  negocio: {
    max_products: Infinity,
    max_categories: Infinity,
    max_images_per_product: 20,
    skins: ['moderna', 'minimalista'],
    can_export_pdf: true,
    can_export_excel: true,
    show_ads: false,
    label: 'Negocio',
    price_monthly: 399,
    price_label: '$399 MXN/mes',
  },
  vip_plus: {
    max_products: Infinity,
    max_categories: Infinity,
    max_images_per_product: 20,
    skins: ['moderna', 'minimalista'],
    can_export_pdf: true,
    can_export_excel: true,
    show_ads: false,
    label: 'VIP Plus',
    price_monthly: null,
    price_label: '$1,599 MXN único',
    included_sales_per_month: 1000,
    extra_sale_fee: 0.5,
  },
}

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}

export function canAddProduct(plan: Plan, currentCount: number): boolean {
  const limits = getPlanLimits(plan)
  return currentCount < limits.max_products
}
