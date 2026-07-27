import type { Metadata } from 'next'
import { getAdminOverviewAction, listStoresAdminAction, listUsersAdminAction } from '@/lib/actions/admin'
import AdminConsole from '@/components/admin/AdminConsole'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Consola de Admin', robots: { index: false } }

// El layout ya bloqueó el acceso a quien no sea súper-admin.
export default async function AdminPage() {
  const [overview, stores, users] = await Promise.all([
    getAdminOverviewAction(),
    listStoresAdminAction(),
    listUsersAdminAction(),
  ])
  return <AdminConsole overview={overview} initialStores={stores} initialUsers={users} />
}
