import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/vast-ads')({
  loader: async () => await adminTable({ data: 'vast-ads' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="VAST Ads" group="Ads Manager" entity="vast-ads" rows={rows}
      columns={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'pre-roll', label: 'Pre-roll' }, { value: 'mid-roll', label: 'Mid-roll' }, { value: 'post-roll', label: 'Post-roll' }] },
        { key: 'url', label: 'VAST Tag URL' },
        { key: 'duration', label: 'Duration' },
        { key: 'target_type', label: 'Target Type' },
        { key: 'enable_skip', label: 'Skippable', type: 'toggle' },
        { key: 'skip_after', label: 'Skip After (s)' },
        { key: 'frequency', label: 'Frequency', type: 'number' },
        { key: 'start_date', label: 'Start Date', type: 'date' },
        { key: 'end_date', label: 'End Date', type: 'date' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
