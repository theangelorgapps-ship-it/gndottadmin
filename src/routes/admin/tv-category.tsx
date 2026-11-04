import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/tv-category')({
  loader: async () => await adminTable({ data: 'tv-category' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="TV Category" group="Live TV" entity="tv-category" rows={rows}
      columns={[{ key: 'name', label: 'Category' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'file_url', label: 'Image', type: 'image' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
