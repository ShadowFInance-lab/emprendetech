import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import POSInterface from '@/components/sales/POSInterface'

export default function NewSalePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sales" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva venta</h1>
          <p className="text-gray-500 text-xs">Selecciona productos y registra la venta</p>
        </div>
      </div>
      <POSInterface />
    </div>
  )
}
