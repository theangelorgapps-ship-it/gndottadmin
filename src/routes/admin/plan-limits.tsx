import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/plan-limits')({
  loader: async () => await adminTable({ data: 'plan-limits' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Plan Limits" group="Subscription" rows={rows} columns={[{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'mappings', label: 'Plans' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
