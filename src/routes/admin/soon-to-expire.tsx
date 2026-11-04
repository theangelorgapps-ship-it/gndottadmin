import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/soon-to-expire')({
  loader: async () => await adminTable({ data: 'soon-to-expire' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Soon to Expire" group="Users" rows={rows} columns={[{ key: 'user_email', label: 'User' }, { key: 'name', label: 'Plan' }, { key: 'end_date', label: 'Expires', kind: 'date' }, { key: 'amount', label: 'Amount', kind: 'money' }]} />
}
