import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/actors')({
  loader: async () => await adminTable({ data: 'actors' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return (
    <CrudTable
      title="Personalities" singular="Personality" group="Content" entity="actors" rows={rows}
      columns={[{ key: 'file_url', label: 'Personality', kind: 'img' }, { key: 'designation', label: 'Designation' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'designation', label: 'Designation' },
        { key: 'file_url', label: 'Photo', type: 'image' },
        { key: 'dob', label: 'Date of Birth', type: 'date' },
        { key: 'place_of_birth', label: 'Place of Birth' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'bio', label: 'Bio', type: 'textarea' },
      ]}
    />
  )
}
