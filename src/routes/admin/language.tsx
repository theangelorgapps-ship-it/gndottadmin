import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/language')({
  loader: async () => await adminTable({ data: 'languages' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <CrudTable
      title="Language Manager"
      group="System Setting"
      entity="languages"
      rows={rows}
      singular="translation"
      empty="No translations found. Add a translation key to localize the experience."
      columns={[
        { key: 'key', label: 'Key', kind: 'title' },
        { key: 'value', label: 'Value' },
        { key: 'language', label: 'Language' },
        { key: 'file', label: 'File' },
      ]}
      fields={[
        { key: 'key', label: 'Key', required: true },
        { key: 'value', label: 'Value', type: 'textarea' },
        { key: 'language', label: 'Language (for example, en or hi)' },
        { key: 'file', label: 'File (for example, labels)' },
      ]}
    />
  )
}
