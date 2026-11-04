import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/banners')({
  loader: async () => await adminTable({ data: 'banners' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="App Banner" group="System Setting" rows={rows} columns={[{ key: 'file_url', label: 'Banner', kind: 'img' }, { key: 'type', label: 'Type' }, { key: 'banner_for', label: 'For' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
