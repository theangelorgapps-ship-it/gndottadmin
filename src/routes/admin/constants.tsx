import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/constants')({
  loader: async () => await adminTable({ data: 'constants' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <div className="min-w-0">
      <AdminTablePage
        title="Constants"
        group="System Setting"
        rows={rows}
        empty="No constants found. System constants will appear here when configured."
        columns={[
          { key: 'name', label: 'Name', kind: 'title' },
          { key: 'type', label: 'Type' },
          { key: 'value', label: 'Value' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
      />
    </div>
  )
}
