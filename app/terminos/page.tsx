import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import LegalFooter from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y Condiciones de uso de Mercanta Business.',
}

const UPDATED = '20 de julio de 2026'

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"><ArrowLeft size={15} /> Volver al inicio</Link>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Términos y Condiciones</h1>
        <p className="text-gray-400 text-sm mt-1 mb-8">Última actualización: {UPDATED}</p>

        <div className="space-y-6 text-gray-700 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">1. Qué es Mercanta Business</h2>
            <p>Mercanta Business es una <strong>plataforma tecnológica</strong> (software como servicio) que permite a negocios independientes crear su catálogo en línea, cobrar con tarjeta, administrar su inventario y dar seguimiento a sus pedidos. Mercanta Business <strong>no vende ni compra productos</strong>: únicamente provee las herramientas para que cada negocio (el «Vendedor») opere su propia tienda.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">2. Mercanta no es parte de la compraventa</h2>
            <p>Toda compra se realiza <strong>directamente entre el comprador y el Vendedor</strong>. Mercanta Business no es vendedor, revendedor, importador ni intermediario de los productos ofrecidos, y no forma parte del contrato de compraventa. No garantizamos la existencia, calidad, seguridad ni legalidad de los productos publicados por los Vendedores.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">3. Responsabilidad del Vendedor</h2>
            <p>El Vendedor es el <strong>único responsable</strong> de:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Los productos que ofrece, sus descripciones, precios, fotografías y existencias.</li>
              <li>El envío, la entrega, los tiempos, la calidad, las garantías y las devoluciones.</li>
              <li>El cumplimiento de sus obligaciones <strong>fiscales</strong> (IVA, ISR, facturación) y legales.</li>
              <li>La atención al cliente y la resolución de cualquier queja o disputa con el comprador.</li>
              <li>Contar con los permisos, licencias o registros que su actividad requiera.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">4. Pagos</h2>
            <p>Los pagos con tarjeta se procesan a través de <strong>Stripe</strong>. Mercanta Business puede cobrar una comisión de plataforma sobre las ventas y/o una suscripción, según el plan contratado. Mercanta no almacena números de tarjeta. Cualquier reembolso o contracargo es responsabilidad del Vendedor y se rige por las políticas de Stripe.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">5. Uso prohibido</h2>
            <p>Está estrictamente prohibido usar la plataforma para ofrecer o vender:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Productos <strong>ilegales</strong>, robados, falsificados o de contrabando.</li>
              <li>Artículos que <strong>infrinjan derechos</strong> de propiedad intelectual, marcas o derechos de autor.</li>
              <li>Armas, drogas, sustancias controladas, especies protegidas o material prohibido por la ley.</li>
              <li>Cualquier bien o servicio que promueva fraude, violencia o actividades ilícitas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">6. Suspensión de cuentas</h2>
            <p>Podemos <strong>suspender o eliminar</strong> una tienda o cuenta, sin previo aviso, cuando detectemos fraude, incumplimiento de estos Términos, uso prohibido, o cuando recibamos reportes fundados de terceros. También podemos retener o revertir pagos asociados a actividades sospechosas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">7. Limitación de responsabilidad</h2>
            <p>El servicio se ofrece «tal cual» y «según disponibilidad». En la medida que la ley lo permita, Mercanta Business no será responsable por daños derivados de las transacciones entre Vendedores y compradores, la falta o retraso de entregas, la calidad de los productos, ni por interrupciones del servicio ajenas a nuestro control.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">8. Cambios a los Términos</h2>
            <p>Podemos actualizar estos Términos en cualquier momento. El uso continuo de la plataforma después de una actualización implica la aceptación de los nuevos Términos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">9. Reportes y contacto</h2>
            <p>Si detectas una tienda o un pedido que incumple estas reglas, usa el botón <Link href="/reportar" className="text-indigo-600 hover:underline">Reportar</Link>. Para cualquier duda sobre estos Términos, contáctanos a través de la plataforma.</p>
          </section>

          <p className="text-sm text-gray-500 pt-2">Al crear una cuenta o usar Mercanta Business, aceptas estos Términos y el <Link href="/privacidad" className="text-indigo-600 hover:underline">Aviso de Privacidad</Link>.</p>
        </div>

        <LegalFooter />
      </div>
    </div>
  )
}
