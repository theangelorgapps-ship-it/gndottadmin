import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/episodes')({
  loader: async () => await adminTable({ data: 'episodes' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Episodes" group="TV Shows" rows={rows} columns={[{ key: 'poster_url', label: 'Episode', kind: 'img' }, { key: 'show', label: 'TV Show' }, { key: 'season', label: 'Season' }, { key: 'duration', label: 'Duration' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
