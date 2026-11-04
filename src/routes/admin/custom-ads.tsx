import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/custom-ads')({
  loader: async () => await adminTable({ data: 'custom-ads' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Custom Ads" group="Ads Manager" entity="custom-ads" rows={rows}
      columns={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }] },
        { key: 'url_type', label: 'URL Type' },
        { key: 'placement', label: 'Placement' },
        { key: 'redirect_url', label: 'Redirect URL' },
        { key: 'duration', label: 'Duration' },
        { key: 'skip_enabled', label: 'Skippable', type: 'toggle' },
        { key: 'skip_after', label: 'Skip After (s)' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
