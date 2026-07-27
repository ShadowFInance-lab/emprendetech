import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { isPlatformAdminAction } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'

/**
 * Consola de Admin de la PLATAFORMA. Shell propio (no usa AdminLayout de las
 * tiendas) y BLOQUEADO: quien no sea súper-admin se va a /dashboard.
 */
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdminAction())) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-slate-900 text-white px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow">
              <ShieldCheck size={18} className="text-white" />
            </span>
            <div>
              <p className="font-bold leading-tight">Consola de Admin</p>
              <p className="text-[11px] text-white/60">Mercanta Business · Plataforma</p>
            </div>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white border border-white/20 rounded-lg px-3 py-1.5">
            <ArrowLeft size={13} /> Volver a mi panel
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 lg:p-6 text-gray-900">{children}</main>
    </div>
  )
}
