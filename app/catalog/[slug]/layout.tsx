import { Inter, Playfair_Display, Poppins } from 'next/font/google'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

/**
 * Layout del catálogo público.
 * Sin sidebar ni header del dashboard — es el "mini-sitio" del negocio.
 */
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${playfair.variable} ${poppins.variable}`}>
      {children}
      <Toaster richColors position="top-center" />
    </div>
  )
}
