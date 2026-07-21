import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, Flag } from 'lucide-react'
import ReportForm from '@/components/ReportForm'

export const metadata: Metadata = {
  title: 'Reportar',
  description: 'Reporta una tienda o un pedido que incumple las reglas de Mercanta Business.',
  robots: { index: false },
}

export default function ReportarPage({ searchParams }: { searchParams: { tienda?: string; pedido?: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50/40 py-10 px-4">
      <div className="max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"><ArrowLeft size={15} /> Volver</Link>
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25 mb-3">
            <Flag size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reportar tienda o pedido</h1>
          <p className="text-gray-500 text-sm mt-1">Ayúdanos a mantener Mercanta seguro. Revisamos cada reporte.</p>
        </div>
        <ReportForm storeSlug={searchParams.tienda} orderNo={searchParams.pedido} />
      </div>
    </div>
  )
}
