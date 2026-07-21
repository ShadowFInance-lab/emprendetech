import Link from 'next/link'

/** Footer con enlaces legales, presente en las superficies públicas de la app. */
export default function LegalFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-gray-100 mt-16 py-8 px-4 text-center text-sm text-gray-400">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <Link href="/terminos" className="hover:text-gray-600 transition-colors">Términos y Condiciones</Link>
        <Link href="/privacidad" className="hover:text-gray-600 transition-colors">Aviso de Privacidad</Link>
        <Link href="/rastreo" className="hover:text-gray-600 transition-colors">Rastrear pedido</Link>
        <Link href="/reportar" className="hover:text-gray-600 transition-colors">Reportar</Link>
      </div>
      <p className="mt-2.5">© {year} Mercanta Business · Plataforma tecnológica para negocios.</p>
    </footer>
  )
}
