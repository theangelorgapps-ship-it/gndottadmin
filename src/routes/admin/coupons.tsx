import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/coupons')({
  loader: async () => await adminTable({ data: 'coupons' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Coupon" group="Subscription" rows={rows} columns={[{ key: 'code', label: 'Code' }, { key: 'discount_type', label: 'Type' }, { key: 'discount', label: 'Discount' }, { key: 'start_date', label: 'Start', kind: 'date' }, { key: 'expire_date', label: 'Expiry', kind: 'date' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
