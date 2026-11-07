import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/faq')({
  loader: async () => await adminTable({ data: 'faq' }),
  component: Page,
})

function Page() {
  const rows = Route.useLoaderData() as any[]

  return (
    <CrudTable
      title="FAQ"
      group="System Setting"
      entity="faq"
      rows={rows}
      singular="FAQ"
      empty="No FAQs found. Add a question and answer to help your audience."
      columns={[
        { key: 'question', label: 'Question', kind: 'title' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'question', label: 'Question', required: true },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'answer', label: 'Answer', type: 'textarea' },
      ]}
    />
  )
}
