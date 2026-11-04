import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/rent-history')({
  loader: async () => await adminTable({ data: 'rent-history' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Rent History" group="Subscription" rows={rows} columns={[{ key: 'title', label: 'Content' }, { key: 'user_email', label: 'User' }, { key: 'type', label: 'Type' }, { key: 'price', label: 'Price', kind: 'money' }, { key: 'view_expiry_date', label: 'Expiry', kind: 'date' }, { key: 'created_at', label: 'Rented', kind: 'date' }]} />
}
