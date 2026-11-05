import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/currency')({
  loader: async () => await adminTable({ data: 'currencies' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Currency" group="System Setting" entity="currencies" rows={rows}
      columns={[
        { key: 'currency_name', label: 'Name' },
        { key: 'currency_code', label: 'Code' },
        { key: 'currency_symbol', label: 'Symbol' },
        { key: 'is_primary', label: 'Primary', kind: 'pill' },
      ]}
      fields={[
        { key: 'currency_name', label: 'Currency Name', required: true },
        { key: 'currency_code', label: 'Currency Code (e.g. USD)' },
        { key: 'currency_symbol', label: 'Symbol (e.g. $)' },
        { key: 'is_primary', label: 'Primary', type: 'toggle' },
        { key: 'currency_position', label: 'Symbol Position (left/right)' },
        { key: 'no_of_decimal', label: 'Decimals', type: 'number' },
        { key: 'thousand_separator', label: 'Thousand Separator' },
        { key: 'decimal_separator', label: 'Decimal Separator' },
      ]}
    />
  )
}
