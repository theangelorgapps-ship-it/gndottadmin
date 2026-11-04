import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/tv-category')({
  loader: async () => await adminTable({ data: 'tv-category' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="TV Category" group="Live TV" rows={rows} columns={[{ key: 'file_url', label: 'Category', kind: 'img' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
