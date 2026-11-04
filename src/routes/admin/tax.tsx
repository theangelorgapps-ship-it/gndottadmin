import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/tax')({
  loader: async () => await adminTable({ data: 'tax' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Tax" group="System Setting" rows={rows} columns={[{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
