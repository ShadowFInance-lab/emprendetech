import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicQuote } from '@/lib/actions/quotes'
import PublicQuoteView from '@/components/quotes/PublicQuoteView'

export const metadata: Metadata = { title: 'Cotización', robots: { index: false } }

export default async function PublicQuotePage({ params }: { params: { token: string } }) {
  const data = await getPublicQuote(params.token)
  if (!data) notFound()
  return <PublicQuoteView data={data} token={params.token} />
}
