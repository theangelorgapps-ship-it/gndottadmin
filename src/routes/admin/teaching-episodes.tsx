import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/teaching-episodes')({
  loader: async () => ({ rows: await adminTable({ data: 'teaching-episodes' }), options: await adminOptions() }),
  component: Page,
})

function Page() {
  const { rows, options } = Route.useLoaderData() as any
  const teachingShows = options.teaching.map((s: any) => ({ value: s.id, label: s.name }))
  return (
    <CrudTable
      title="Episodes" group="Teachings" entity="teaching-episodes" rows={rows}
      columns={[{ key: 'name', label: 'Episode' }, { key: 'show', label: 'Teaching' }, { key: 'season', label: 'Volume (Series)' }, { key: 'duration', label: 'Duration' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'episode_number', label: 'Episode #' },
        { key: 'entertainment_id', label: 'Teaching', type: 'select', required: true, options: teachingShows },
        { key: 'season_id', label: 'Volume (Series)', type: 'select', dependsOn: 'entertainment_id', options: options.seasons.filter((s: any) => s.type === 'teaching').map((s: any) => ({ value: s.id, label: s.name, parentValue: s.entertainment_id })) },
        { key: 'duration', label: 'Duration', placeholder: '45m' },
        { key: 'release_date', label: 'Release Date', type: 'date' },
        { key: 'poster_url', label: 'Poster', type: 'image' },
        { key: 'bunny_video_url', label: 'Bunny video ID or embed', placeholder: 'Paste a Bunny ID, link, or iframe embed' },
        { key: 'video_url_input', label: 'Original video URL' },
        { key: 'access', label: 'Access', type: 'select', options: [{ value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' }] },
        { key: 'price', label: 'Price', type: 'number' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'short_desc', label: 'Short Description', type: 'textarea' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}
