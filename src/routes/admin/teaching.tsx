import { createFileRoute } from '@tanstack/react-router'
import { adminListContent } from '../../lib/admin'
import { ContentAdmin } from '../../components/admin-content'

export const Route = createFileRoute('/admin/teaching')({
  loader: async () => await adminListContent({ data: 'teaching' }),
  component: () => <ContentAdmin items={Route.useLoaderData()} type="teaching" title="Teachings" />,
})
