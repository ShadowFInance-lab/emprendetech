import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import LegalFooter from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad',
  description: 'Aviso de Privacidad de Mercanta Business.',
}

const UPDATED = '20 de julio de 2026'

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"><ArrowLeft size={15} /> Volver al inicio</Link>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Aviso de Privacidad</h1>
        <p className="text-gray-400 text-sm mt-1 mb-8">Última actualización: {UPDATED}</p>

        <div className="space-y-6 text-gray-700 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">1. Quiénes somos</h2>
            <p>Mercanta Business es una plataforma tecnológica que permite a negocios crear su tienda en línea. Este Aviso explica qué datos tratamos y para qué. Para los datos de cada tienda, el <strong>Vendedor</strong> es el responsable del tratamiento de los datos de sus clientes; Mercanta actúa como proveedor tecnológico.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">2. Datos que recolectamos</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Cuenta del negocio:</strong> nombre, correo electrónico y datos de la tienda.</li>
              <li><strong>Pedidos:</strong> los datos que el comprador captura al comprar (nombre, teléfono, dirección de entrega, correo).</li>
              <li><strong>Pagos:</strong> se procesan por Stripe. <strong>No almacenamos números de tarjeta</strong>; solo identificadores de la transacción.</li>
              <li><strong>Datos técnicos:</strong> cookies de sesión y del carrito de compras, necesarias para el funcionamiento del servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">3. Para qué usamos tus datos</h2>
            <p>Usamos los datos para operar la plataforma, crear y dar seguimiento a los pedidos, procesar pagos, enviar notificaciones (por ejemplo, el correo de envío de un pedido), brindar soporte y prevenir fraudes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">4. Con quién compartimos datos (encargados)</h2>
            <p>Compartimos datos únicamente con los proveedores necesarios para operar el servicio:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Stripe</strong> — procesamiento de pagos.</li>
              <li><strong>Supabase</strong> — base de datos y autenticación.</li>
              <li><strong>Vercel</strong> — alojamiento de la aplicación.</li>
              <li><strong>Resend</strong> — envío de correos transaccionales (si está configurado).</li>
            </ul>
            <p className="mt-2">No vendemos tus datos personales a terceros.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">5. Tus derechos (ARCO)</h2>
            <p>Puedes solicitar el <strong>Acceso, Rectificación, Cancelación u Oposición</strong> (derechos ARCO) al tratamiento de tus datos personales. Para pedidos de una tienda específica, dirígete al Vendedor correspondiente; para datos de tu cuenta en la plataforma, contáctanos a través de la app.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">6. Seguridad y conservación</h2>
            <p>Aplicamos medidas de seguridad razonables (cifrado en tránsito, control de acceso por RLS) para proteger la información. Conservamos los datos el tiempo necesario para prestar el servicio y cumplir obligaciones legales y fiscales.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">7. Cambios a este Aviso</h2>
            <p>Podemos actualizar este Aviso de Privacidad. Publicaremos aquí la versión vigente con su fecha de actualización.</p>
          </section>

          <p className="text-sm text-gray-500 pt-2">Consulta también nuestros <Link href="/terminos" className="text-indigo-600 hover:underline">Términos y Condiciones</Link>.</p>
        </div>

        <LegalFooter />
      </div>
    </div>
  )
}
