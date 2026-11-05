import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/countries')({
  loader: async () => await adminTable({ data: 'countries' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Countries" group="System Setting" entity="countries" rows={rows}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'dial_code', label: 'Dial Code' },
        { key: 'currency_code', label: 'Currency' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'code', label: 'Country Code (e.g. US)' },
        { key: 'dial_code', label: 'Dial Code (e.g. +1)' },
        { key: 'currency_name', label: 'Currency Name' },
        { key: 'symbol', label: 'Currency Symbol' },
        { key: 'currency_code', label: 'Currency Code' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
