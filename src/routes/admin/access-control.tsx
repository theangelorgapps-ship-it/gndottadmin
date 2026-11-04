import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/access-control')({
  loader: async () => await adminTable({ data: 'access-control' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Access Control" group="System Setting" rows={rows} columns={[{ key: 'title', label: 'Role' }, { key: 'name', label: 'Name' }, { key: 'users', label: 'Users' }, { key: 'permissions', label: 'Permissions' }]} />
}
