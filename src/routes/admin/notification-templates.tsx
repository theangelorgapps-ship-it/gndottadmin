import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/notification-templates')({
  loader: async () => await adminTable({ data: 'notification-templates' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <CrudTable
      title="Notification Templates"
      group="Notifications"
      entity="notification-templates"
      rows={rows}
      singular="notification template"
      empty="No notification templates found. Add a template to prepare reusable messages."
      columns={[
        { key: 'name', label: 'Name', kind: 'title' },
        { key: 'label', label: 'Label' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'label', label: 'Label' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Template Body', type: 'textarea' },
      ]}
    />
  )
}
