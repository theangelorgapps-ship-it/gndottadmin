import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/plan-limits')({
  loader: async () => await adminTable({ data: 'plan-limits' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <>
    <p className="mb-5 text-sm text-muted-foreground">Shared access is enforced by subscription duration: monthly 2 email logins / 5 pooled devices; annual 4 email logins / 10 pooled devices, including the owner. Changing legacy profile or device limitation labels here does not change these enforced limits. Each account keeps its own profiles.</p>
    <CrudTable
      title="Plan Limits"
      group="Subscription"
      entity="plan-limits"
      rows={rows}
      singular="plan limit"
      empty="No plan limits found. Add a limit to define subscription restrictions."
      columns={[
        { key: 'title', label: 'Title', kind: 'title' },
        { key: 'slug', label: 'Slug' },
        { key: 'mappings', label: 'Plans' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'slug', label: 'Slug' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
    </>
  )
}
