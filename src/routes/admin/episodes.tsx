import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/episodes')({
  loader: async () => {
    const [rows, options] = await Promise.all([adminTable({ data: 'episodes' }), adminOptions()])
    return { rows, options }
  },
  component: Page,
})

function Page() {
  const { rows, options } = Route.useLoaderData() as any
  return (
    <CrudTable
      title="Episodes" group="Shows" entity="episodes" rows={rows}
      columns={[{ key: 'poster_url', label: 'Episode', kind: 'img' }, { key: 'show', label: 'Show' }, { key: 'season', label: 'Series' }, { key: 'duration', label: 'Duration' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'episode_number', label: 'Episode #', type: 'number' },
        { key: 'entertainment_id', label: 'Show', type: 'select', required: true, options: options.shows.map((s: any) => ({ value: s.id, label: s.name })) },
        { key: 'season_id', label: 'Name of the Series', type: 'select', dependsOn: 'entertainment_id', options: options.seasons.filter((s: any) => s.type === 'tvshow').map((s: any) => ({ value: s.id, label: s.name, parentValue: s.entertainment_id })) },
        { key: 'duration', label: 'Duration', placeholder: '45m' },
        { key: 'release_date', label: 'Release Date', type: 'date' },
        { key: 'poster_url', label: 'Poster', type: 'image' },
        { key: 'bunny_video_url', label: 'Bunny video ID or embed', placeholder: 'Paste a Bunny ID, link, or iframe embed' },
        { key: 'video_url_input', label: 'Original video URL' },
        { key: 'access', label: 'Access', type: 'select', required: true, options: [{ value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid (pay-per-view)' }] },
        { key: 'price', label: 'Price', type: 'number' },
        { key: 'status', label: 'Status', type: 'toggle' },
        { key: 'short_desc', label: 'Short Description', type: 'textarea' },
        { key: 'description', label: 'Description', type: 'richtext' },
      ]}
    />
  )
}
