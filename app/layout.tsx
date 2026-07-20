import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { getAppUrl } from '@/lib/utils/app-url'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Mercanta Business — Plataforma SaaS para negocios',
    template: '%s | Mercanta Business',
  },
  description:
    'Crea tu catálogo online, administra inventario, registra ventas y haz crecer tu negocio.',
  // getAppUrl() nunca devuelve localhost en producción (ver lib/utils/app-url).
  metadataBase: new URL(getAppUrl()),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
