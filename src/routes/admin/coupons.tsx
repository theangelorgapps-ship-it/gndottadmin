import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/coupons')({
  loader: async () => await adminTable({ data: 'coupons' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <CrudTable
      title="Coupons"
      group="Subscription"
      entity="coupons"
      rows={rows}
      singular="coupon"
      empty="No coupons found. Add a coupon to offer a subscription discount."
      columns={[
        { key: 'code', label: 'Code', kind: 'title' },
        { key: 'discount_type', label: 'Type' },
        { key: 'discount', label: 'Discount' },
        { key: 'start_date', label: 'Start', kind: 'date' },
        { key: 'expire_date', label: 'Expiry', kind: 'date' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'code', label: 'Code', required: true },
        {
          key: 'discount_type', label: 'Discount Type', type: 'select', options: [
            { value: 'percent', label: 'Percentage' },
            { value: 'fixed', label: 'Fixed' },
          ],
        },
        { key: 'discount', label: 'Discount', type: 'number' },
        { key: 'start_date', label: 'Start Date', type: 'date' },
        { key: 'expire_date', label: 'Expiry Date', type: 'date' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
