import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/pages')({
  loader: async () => await adminTable({ data: 'pages' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Pages" group="System Setting" rows={rows} columns={[{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
