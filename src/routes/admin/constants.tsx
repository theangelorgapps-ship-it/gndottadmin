import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/constants')({
  loader: async () => await adminTable({ data: 'constants' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Constants" group="System Setting" rows={rows} columns={[{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value' }, { key: 'status', label: 'Status', kind: 'pill' }]} />
}
