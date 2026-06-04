import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Crear Cuenta' }

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-white text-2xl font-bold">EmprendeTech</span>
          </a>
          <p className="text-slate-400 mt-2 text-sm">
            Empieza gratis. Sin tarjeta de crédito.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
