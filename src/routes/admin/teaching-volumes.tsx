import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { SeriesAdmin } from '../../components/SeriesAdmin'

export const Route = createFileRoute('/admin/teaching-volumes')({
  loader: async () => ({ rows: await adminTable({ data: 'teaching-volumes' }), options: await adminOptions() }),
  component: Page,
})

function Page() {
  const { rows, options } = Route.useLoaderData()
  return <SeriesAdmin type="teaching" rows={rows} parents={options.teaching} />
}
