import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/banners')({
  loader: async () => ({ rows: await adminTable({ data: 'banners' }), options: await adminOptions() }),
  component: Page,
})

function Page() {
  const { rows, options } = Route.useLoaderData() as any
  return (
    <CrudTable
      title="App Banner" group="System Setting" entity="banners" rows={rows}
      columns={[{ key: 'file_url', label: 'Banner', kind: 'img' }, { key: 'type', label: 'Type' }, { key: 'banner_for', label: 'For' }, { key: 'status', label: 'Status', kind: 'pill' }]}
      fields={[
        { key: 'title', label: 'Title' },
        { key: 'type', label: 'Type', type: 'select', options: [{ value: 'movie', label: 'Movie' }, { value: 'tvshow', label: 'TV Show' }, { value: 'video', label: 'Video' }] },
        { key: 'type_id', label: 'Content', type: 'select', options: options.contents.map((c: any) => ({ value: String(c.id), label: `${c.name} (${c.type})` })) },
        { key: 'banner_for', label: 'Banner For', type: 'select', options: [{ value: 'home', label: 'Home' }, { value: 'movie', label: 'Movie' }, { value: 'tv_show', label: 'TV Show' }, { value: 'video', label: 'Video' }] },
        { key: 'file_url', label: 'Banner Image', type: 'image' },
        { key: 'poster_url', label: 'Poster Image', type: 'image' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
