import { createFileRoute } from '@tanstack/react-router'
import { adminTable } from '../../lib/admin'
import { AdminTablePage } from '../../components/AdminTable'

export const Route = createFileRoute('/admin/rent-history')({
  loader: async () => await adminTable({ data: 'rent-history' }),
  component: Page,
})

const RENTAL_TYPE_LABELS: Record<string, string> = {
  movie: 'Sermon',
  tvshow: 'Show',
  video: 'Video',
  episode: 'Show episode',
}

function Page() {
  const rows = Route.useLoaderData() as any[]
  const displayRows = rows.map((row) => ({
    ...row,
    type_label: RENTAL_TYPE_LABELS[String(row.type)] ?? row.type ?? '—',
  }))

  return (
    <div className="min-w-0">
      <AdminTablePage
        title="Rent History"
        group="Subscription"
        rows={displayRows}
        empty="No rental history found. Rental purchases will appear here."
        columns={[
          { key: 'title', label: 'Title', kind: 'title' },
          { key: 'user_email', label: 'User' },
          { key: 'type_label', label: 'Type' },
          { key: 'price', label: 'Price', kind: 'money' },
          { key: 'view_expiry_date', label: 'Expiry', kind: 'date' },
          { key: 'created_at', label: 'Rented', kind: 'date' },
        ]}
      />
    </div>
  )
}
