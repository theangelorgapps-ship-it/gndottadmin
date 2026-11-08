import { createFileRoute } from '@tanstack/react-router'
import { adminTable, adminOptions } from '../../lib/admin'
import { CrudTable } from '../../components/CrudTable'

export const Route = createFileRoute('/admin/banners')({
  loader: async () => ({ rows: await adminTable({ data: 'banners' }), options: await adminOptions() }),
  component: Page,
})

const CONTENT_TYPE_LABELS: Record<string, string> = {
  movie: 'Sermon',
  tvshow: 'Show',
  teaching: 'Teaching',
  video: 'Video',
}

const BANNER_FOR_LABELS: Record<string, string> = {
  home: 'Home',
  movie: 'Sermons',
  tv_show: 'Shows',
  video: 'Videos',
}

function contentTypeLabel(type: unknown) {
  return CONTENT_TYPE_LABELS[String(type)] ?? String(type ?? '—')
}

function Page() {
  const { rows, options } = Route.useLoaderData() as any
  const displayRows = rows.map((row: any) => ({
    ...row,
    name: row.title,
    type_label: contentTypeLabel(row.type),
    banner_for_label: BANNER_FOR_LABELS[String(row.banner_for)] ?? row.banner_for ?? '—',
  }))

  return (
    <CrudTable
      title="App Banners"
      group="System Setting"
      entity="banners"
      rows={displayRows}
      singular="app banner"
      empty="No app banners found. Add a banner to feature a Sermon, Show, or Video."
      columns={[
        { key: 'file_url', label: 'Banner', kind: 'img' },
        { key: 'type_label', label: 'Type' },
        { key: 'banner_for_label', label: 'Placement' },
        { key: 'status', label: 'Status', kind: 'pill' },
      ]}
      fields={[
        { key: 'title', label: 'Title' },
        {
          key: 'type', label: 'Type', type: 'select', options: [
            { value: 'movie', label: 'Sermon' },
            { value: 'tvshow', label: 'Show' },
            { value: 'teaching', label: 'Teaching' },
            { value: 'video', label: 'Video' },
          ],
        },
        {
          key: 'type_id', label: 'Sermon, Show, Teaching, or Video', type: 'select', dependsOn: 'type',
          options: options.contents.map((content: any) => ({
            value: String(content.id),
            label: `${content.name} (${contentTypeLabel(content.type)})`,
            parentValue: content.type,
          })),
        },
        {
          key: 'banner_for', label: 'Banner Placement', type: 'select', options: [
            { value: 'home', label: 'Home' },
            { value: 'movie', label: 'Sermons' },
            { value: 'tv_show', label: 'Shows' },
            { value: 'video', label: 'Videos' },
          ],
        },
        { key: 'file_url', label: 'Banner Image', type: 'image' },
        { key: 'poster_url', label: 'Poster Image', type: 'image' },
        { key: 'status', label: 'Status', type: 'toggle' },
      ]}
    />
  )
}
