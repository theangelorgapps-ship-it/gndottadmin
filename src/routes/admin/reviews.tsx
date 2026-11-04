import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/reviews')({
  loader: async () => await adminTable({ data: 'reviews' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Reviews" group="Users" entity="reviews" rows={rows} fields={[]}
      columns={[{ key: 'content', label: 'Content' }, { key: 'author', label: 'User' }, { key: 'rating', label: 'Rating', kind: 'stars' }, { key: 'review', label: 'Review' }, { key: 'created_at', label: 'Date', kind: 'date' }]}
    />
  )
}
