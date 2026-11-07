import { createFileRoute } from '@tanstack/react-router'
import { adminListContent } from '../../lib/admin'
import { ContentAdmin } from '../../components/admin-content'

export const Route = createFileRoute('/admin/movies')({
  loader: async () => await adminListContent({ data: 'movie' }),
  component: () => <ContentAdmin items={Route.useLoaderData()} type="movie" title="Sermons" />,
})
