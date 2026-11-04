import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/tax')({
  loader: async () => await adminTable({ data: 'tax' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Tax" group="System Setting" entity="tax" rows={rows}
      columns={[{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed' }] },
        { key: 'value', label: 'Value', type: 'number' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
