import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/media-library')({
  loader: async () => await adminTable({ data: 'media-library' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]
  return <AdminTablePage title="Media Library" group="Main" rows={rows} columns={[{ key: 'name', label: 'Name' }, { key: 'file_name', label: 'File' }, { key: 'mime_type', label: 'Type' }, { key: 'size', label: 'Size' }, { key: 'created_at', label: 'Added', kind: 'date' }]} />
}
