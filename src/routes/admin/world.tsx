import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/world')({
  loader: async () => await adminTable({ data: 'worlds' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="World" group="System Setting" entity="worlds" rows={rows}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'state_id', label: 'State ID' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'state_id', label: 'State ID', type: 'number' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
