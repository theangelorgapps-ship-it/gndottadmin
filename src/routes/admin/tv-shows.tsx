import { createFileRoute } from '@tanstack/react-router'
import { adminListContent } from '../../lib/admin'
import { ContentAdmin } from '../../components/admin-content'

export const Route = createFileRoute('/admin/tv-shows')({
  loader: async () => await adminListContent({ data: 'tvshow' }),
  component: () => <ContentAdmin items={Route.useLoaderData()} type="tvshow" title="TV Shows" />,
})
