import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/seasons')({
  loader: async () => await adminTable({ data: 'seasons' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Seasons" group="TV Shows" rows={rows} columns={[{ key: 'poster_url', label: 'Season', kind: 'img' }, { key: 'show', label: 'TV Show' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
