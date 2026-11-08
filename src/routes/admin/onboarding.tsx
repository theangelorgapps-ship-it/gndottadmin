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
      title="Onboarding"
      group="System Setting"
      entity="onboarding"
      rows={rows}
      singular="onboarding screen"
      empty="No onboarding screens found. Add a screen to guide new users."
      columns={[
        { key: 'file_url', label: 'Screen', kind: 'img' },
        { key: 'title', label: 'Title', kind: 'title' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'file_url', label: 'Image', type: 'image' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
