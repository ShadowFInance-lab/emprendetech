import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductForm from '@/components/inventory/ProductForm'

export default async function EditProductPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) redirect('/onboarding')

  // Cargar producto con imágenes y categoría
  const { data: product } = await supabase
    .from('products')
    .select('*, product_images(*), categories(*)')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .single()

  if (!product) notFound()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('name')

  // Ordenar imágenes por sort_order
  if (product.product_images) {
    product.product_images.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    )
  }

  return (
    <ProductForm
      product={product}
      categories={categories ?? []}
      storeId={store.id}
    />
  )
}
