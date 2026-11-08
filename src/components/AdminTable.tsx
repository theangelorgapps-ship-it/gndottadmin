import { AdminDataTable, type DataCol } from './AdminDataTable'

export type Col = DataCol

export function AdminTablePage({
  title,
  group = 'Dashboard',
  rows,
  columns,
  empty,
}: {
  title: string
  group?: string
  rows: any[]
  columns: Col[]
  empty?: string
}) {
  return (
    <div>
      <div className="breadcrumb">{group} <span className="sep">/</span> <span className="here">{title}</span></div>
      <AdminDataTable
        rows={rows}
        columns={columns}
        searchable={['name', 'title', 'label', 'email']}
        empty={empty ?? `No ${title.toLowerCase()} records.`}
      />
    </div>
  )
}
