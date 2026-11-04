import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/faq')({
  loader: async () => await adminTable({ data: 'faq' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="FAQ" group="System Setting" rows={rows} columns={[{ key: 'question', label: 'Question' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
