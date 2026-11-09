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
      title="Custom Ads"
      group="Ads Manager"
      entity="custom-ads"
      rows={rows}
      singular="custom ad"
      empty="No custom ads found. Add an ad to configure a campaign."
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name', kind: 'title' },
        { key: 'type', label: 'Type' },
        { key: 'is_enable', label: 'Enabled', kind: 'pill' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        {
          key: 'type', label: 'Type', type: 'select', options: [
            { value: 'image', label: 'Image' },
            { value: 'video', label: 'Video' },
          ],
        },
        { key: 'media', label: 'Media image or video URL', type: 'image', required: true },
        { key: 'url_type', label: 'Media source', type: 'select', options: [{ value: 'local', label: 'Media library' }, { value: 'url', label: 'External URL' }] },
        { key: 'placement', label: 'Placement', type: 'select', required: true, options: [{ value: 'home_page', label: 'Home page' }] },
        { key: 'redirect_url', label: 'Destination', placeholder: 'https://example.com or /shop' },
        { key: 'duration', label: 'Duration (seconds)', type: 'number' },
        { key: 'skip_enabled', label: 'Skippable', type: 'toggle' },
        { key: 'skip_after', label: 'Skip After (seconds)' },
        { key: 'start_date', label: 'Start date', type: 'date' },
        { key: 'end_date', label: 'End date', type: 'date' },
        { key: 'is_enable', label: 'Enabled', type: 'toggle' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
