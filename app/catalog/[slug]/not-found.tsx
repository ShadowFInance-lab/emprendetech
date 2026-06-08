import Link from 'next/link'

export default function CatalogNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Tienda no encontrada
        </h1>
        <p className="text-gray-500 mb-6">
          Esta tienda no existe o no está disponible. Verifica que la URL sea correcta.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Ir a Mercanta Business
        </Link>
      </div>
    </div>
  )
}
