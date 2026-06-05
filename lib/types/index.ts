// ============================================================
// EmprendeTech — Tipos TypeScript globales
// ============================================================

export type Plan = 'free' | 'emprendedor' | 'negocio' | 'vip_plus'
export type PlanStatus = 'active' | 'expired' | 'cancelled' | 'trial'
export type Skin = 'moderna' | 'minimalista'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type SaleStatus = 'completed' | 'cancelled' | 'refunded'
export type MovementType = 'sale' | 'sale_cancel' | 'manual_entry' | 'manual_exit' | 'adjustment'
export type AlertType = 'low_stock' | 'out_of_stock'

export interface Profile {
  id: string
  full_name: string | null
  plan: Plan
  plan_status: PlanStatus
  plan_expires_at: string | null
  onboarding_done: boolean
  created_at: string
  updated_at: string
}

export interface Store {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  tagline: string | null
  logo_url: string | null
  banner_url: string | null
  whatsapp: string | null
  facebook: string | null
  instagram: string | null
  tiktok: string | null
  skin: Skin
  primary_color: string
  secondary_color: string
  button_color: string
  font_family: string
  product_order: string
  currency: string
  low_stock_alert: number
  show_prices: boolean
  catalog_active: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  store_id: string
  name: string
  slug: string
  image_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  is_primary: boolean
  sort_order: number
  created_at: string
}

export interface Product {
  id: string
  store_id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  sku: string | null
  barcode: string | null
  cost_price: number
  sale_price: number
  compare_at_price: number | null
  stock: number
  is_featured: boolean
  is_active: boolean
  is_new: boolean
  total_sold: number
  sort_order: number
  created_at: string
  updated_at: string
  // Relaciones
  product_images?: ProductImage[]
  categories?: Category | null
}

export interface Customer {
  id: string
  store_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  total_spent: number
  created_at: string
  updated_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  unit_cost: number
  subtotal: number
  created_at: string
  // Relaciones
  products?: Product
}

export interface Sale {
  id: string
  store_id: string
  customer_id: string | null
  folio: string
  subtotal: number
  discount_amt: number
  total: number
  total_cost: number
  profit: number
  payment_method: PaymentMethod
  status: SaleStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Relaciones
  sale_items?: SaleItem[]
  customers?: Customer | null
}

export interface InventoryMovement {
  id: string
  store_id: string
  product_id: string
  type: MovementType
  quantity: number
  stock_before: number
  stock_after: number
  reference_id: string | null
  notes: string | null
  created_at: string
  products?: Product
}

export interface Alert {
  id: string
  store_id: string
  type: AlertType
  title: string
  body: string | null
  is_read: boolean
  data: Record<string, unknown> | null
  created_at: string
}

export interface Subscription {
  id: string
  profile_id: string
  plan: Plan
  status: PlanStatus
  provider: string
  provider_sub_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}

// ─── Tipos para el POS ──────────────────────────────────────
export interface CartItem {
  product_id: string
  product_name: string
  sale_price: number
  cost_price: number
  quantity: number
  stock: number
  image_url?: string
}

// ─── Tipos para Dashboard KPIs ──────────────────────────────
export interface DashboardStats {
  sales_today: number
  sales_week: number
  sales_month: number
  profit_today: number
  profit_month: number
  total_products: number
  low_stock_count: number
  out_of_stock_count: number
}
