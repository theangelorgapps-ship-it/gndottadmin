import { CrudTable, type Field } from './CrudTable'

export function seriesFields(type: 'tvshow' | 'teaching', parents: any[]): Field[] {
  const teaching = type === 'teaching'
  return [
    { key: 'name', label: teaching ? 'Name of the Volume (Series)' : 'Name of the Series', required: true },
    { key: 'entertainment_id', label: teaching ? 'Teachings' : 'Show', type: 'select', required: true, options: parents.map((p) => ({ value: p.id, label: p.name })) },
    { key: 'season_number', label: teaching ? 'Volume number' : 'Series number', type: 'number', required: true },
    { key: 'poster_url', label: 'Poster', type: 'image' },
    { key: 'access', label: 'Access', type: 'select', required: true, options: [{ value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid (pay-per-view)' }] },
    { key: 'price', label: 'Price', type: 'number' },
    { key: 'status', label: 'Status', type: 'toggle' },
    { key: 'short_desc', label: 'Short Description', type: 'textarea' },
    { key: 'description', label: 'Description', type: 'richtext' },
  ]
}

export function SeriesAdmin({ type, rows, parents }: { type: 'tvshow' | 'teaching'; rows: any[]; parents: any[] }) {
  const teaching = type === 'teaching'
  return <CrudTable
    title={teaching ? 'Volumes (Series)' : 'Series'}
    singular={teaching ? 'Volume (Series)' : 'Series'}
    group={teaching ? 'Teachings' : 'Shows'}
    entity={teaching ? 'teaching-volumes' : 'series'}
    rows={rows}
    columns={[
      { key: 'poster_url', label: teaching ? 'Volume (Series)' : 'Name of the Series', kind: 'img' },
      { key: 'show', label: teaching ? 'Teachings' : 'Show' },
      { key: 'season_number', label: teaching ? 'Volume #' : 'Series #' },
      { key: 'status', label: 'Status', kind: 'pill' },
    ]}
    fields={seriesFields(type, parents)}
  />
}
