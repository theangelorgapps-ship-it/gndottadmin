import { img } from './Poster'

export type Col = { key: string; label: string; kind?: 'text' | 'img' | 'pill' | 'money' | 'date' | 'stars' }

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
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>{rows.length} records</span>
        <span className="spacer" />
      </div>
      {rows.length === 0 ? (
        <div className="empty">{empty ?? `No ${title.toLowerCase()} records.`}</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key}>{renderCell(r, c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function renderCell(r: any, c: Col) {
  const v = r[c.key]
  switch (c.kind) {
    case 'img':
      return (
        <div className="cell-main">
          <img src={img(v)} alt="" />
          <span className="cell-title">{r[c.key.replace('file_url', 'name').replace('poster_url', 'name')] ?? r.name ?? ''}</span>
        </div>
      )
    case 'pill':
      return <span className={`pill ${v == 1 ? 'on' : 'off'}`}>{v == 1 ? 'Active' : 'Off'}</span>
    case 'money':
      return <>${Number(v ?? 0).toFixed(2)}</>
    case 'date':
      return <>{v ? String(v).slice(0, 10) : '—'}</>
    case 'stars':
      return <>{'★'.repeat(Math.round(Number(v) || 0))}{'☆'.repeat(5 - Math.round(Number(v) || 0))}</>
    default:
      return <>{v ?? '—'}</>
  }
}
