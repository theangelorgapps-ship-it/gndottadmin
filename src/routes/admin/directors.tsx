import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/directors')({
  loader: async () => await adminTable({ data: 'directors' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Directors" group="Cast & Crew" rows={rows} columns={[{ key: 'file_url', label: 'Director', kind: 'img' }, { key: 'designation', label: 'Designation' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
