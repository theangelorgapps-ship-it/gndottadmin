import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/reviews')({
  loader: async () => await adminTable({ data: 'reviews' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Reviews" group="Users" rows={rows} columns={[{ key: 'content', label: 'Content' }, { key: 'author', label: 'User' }, { key: 'rating', label: 'Rating', kind: 'stars' }, { key: 'review', label: 'Review' }, { key: 'created_at', label: 'Date', kind: 'date' }]} />
}
