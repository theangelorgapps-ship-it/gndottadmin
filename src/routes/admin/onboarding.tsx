import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/onboarding')({
  loader: async () => await adminTable({ data: 'onboarding' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Onboarding" group="System Setting" entity="onboarding" rows={rows}
      columns={[{ key: 'file_url', label: 'Screen', kind: 'img' }, { key: 'title', label: 'Title' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'file_url', label: 'Image', type: 'image' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
