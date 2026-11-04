import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/actors')({
  loader: async () => await adminTable({ data: 'actors' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Actors" group="Cast & Crew" rows={rows} columns={[{ key: 'file_url', label: 'Actor', kind: 'img' }, { key: 'designation', label: 'Designation' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
