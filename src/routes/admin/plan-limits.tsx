import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/plan-limits')({
  loader: async () => await adminTable({ data: 'plan-limits' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Plan Limits" group="Subscription" entity="plan-limits" rows={rows}
      columns={[{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'mappings', label: 'Plans' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'slug', label: 'Slug' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
