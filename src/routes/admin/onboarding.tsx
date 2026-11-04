import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/onboarding')({
  loader: async () => await adminTable({ data: 'onboarding' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Onboarding" group="System Setting" rows={rows} columns={[{ key: 'file_url', label: 'Screen', kind: 'img' }, { key: 'title', label: 'Title' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
