import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/notification-templates')({
  loader: async () => await adminTable({ data: 'notification-templates' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Templates" group="Notifications" rows={rows} columns={[{ key: 'name', label: 'Name' }, { key: 'label', label: 'Label' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
