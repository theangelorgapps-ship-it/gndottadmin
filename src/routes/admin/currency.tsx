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
      title="Currencies"
      group="System Setting"
      entity="currencies"
      rows={rows}
      singular="currency"
      empty="No currencies found. Add a currency to support regional pricing."
      columns={[
        { key: 'currency_name', label: 'Name', kind: 'title' },
        { key: 'currency_code', label: 'Code' },
        { key: 'currency_symbol', label: 'Symbol' },
        { key: 'is_primary', label: 'Primary', kind: 'pill' },
      ]}
      fields={[
        { key: 'currency_name', label: 'Currency Name', required: true },
        { key: 'currency_code', label: 'Currency Code (for example, USD)' },
        { key: 'currency_symbol', label: 'Symbol (for example, $)' },
        { key: 'is_primary', label: 'Primary', type: 'toggle' },
        { key: 'currency_position', label: 'Symbol Position (left or right)' },
        { key: 'no_of_decimal', label: 'Decimals', type: 'number' },
        { key: 'thousand_separator', label: 'Thousand Separator' },
        { key: 'decimal_separator', label: 'Decimal Separator' },
      ]}
    />
  )
}
