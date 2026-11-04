import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/seasons')({
  loader: async () => ({ rows: await adminTable({ data: 'seasons' }), options: await adminOptions() }),
  component: Page,
})

function Page() {
  const { rows, options } = Route.useLoaderData() as any
  return (
    <CrudTable
      title="Seasons" group="TV Shows" entity="seasons" rows={rows}
      columns={[{ key: 'poster_url', label: 'Season', kind: 'img' }, { key: 'show', label: 'TV Show' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'season_number', label: 'Season #', type: 'number' },
        { key: 'entertainment_id', label: 'TV Show', type: 'select', options: options.shows.map((s: any) => ({ value: s.id, label: s.name })) },
        { key: 'poster_url', label: 'Poster', type: 'image' },
        { key: 'access', label: 'Access', type: 'select', options: [{ value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' }] },
        { key: 'price', label: 'Price', type: 'number' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'short_desc', label: 'Short Description', type: 'textarea' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
