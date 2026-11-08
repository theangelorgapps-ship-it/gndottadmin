import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { SeriesAdmin } from '../../components/SeriesAdmin'

export const Route = createFileRoute('/admin/series')({
  loader: async () => ({ rows: await adminTable({ data: 'series' }), options: await adminOptions() }),
  component: Page,
})

function Page() {
  const { rows, options } = Route.useLoaderData()
  return <SeriesAdmin type="tvshow" rows={rows} parents={options.shows} />
}
