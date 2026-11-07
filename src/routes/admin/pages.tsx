import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/pages')({
  loader: async () => await adminTable({ data: 'pages' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <CrudTable
      title="Pages"
      group="System Setting"
      entity="pages"
      rows={rows}
      singular="page"
      empty="No custom pages found. Add a page to publish informational content."
      columns={[
        { key: 'name', label: 'Name', kind: 'title' },
        { key: 'slug', label: 'Slug' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'slug', label: 'Slug', placeholder: 'privacy-policy' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Content (HTML allowed)', type: 'textarea' },
      ]}
    />
  )
}
