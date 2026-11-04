import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListGenres, adminUpsertGenre, adminDeleteGenre } from '../../lib/admin'

export const Route = createFileRoute('/admin/genres')({
  loader: async () => await adminListGenres(),
  component: AdminGenres,
})

function AdminGenres() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState<{ id?: number; name: string; status: number } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    setBusy(true)
    await adminUpsertGenre({ data: editing })
    setBusy(false)
    setEditing(null)
    router.invalidate()
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete genre "${name}"?`)) return
    await adminDeleteGenre({ data: id })
    router.invalidate()
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Genres</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', status: 1 })}>+ New Genre</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Slug</th><th>Titles</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
        <tbody>
          {items.map((g: any) => (
            <tr key={g.id}>
              <td><span className="cell-title">{g.name}</span></td>
              <td>{g.slug}</td>
              <td>{g.titles}</td>
              <td><span className={`pill ${g.status == 1 ? 'on' : 'off'}`}>{g.status == 1 ? 'Active' : 'Off'}</span></td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => setEditing({ id: g.id, name: g.name, status: g.status ?? 1 })}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(g.id, g.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <div className="modal-back" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
            <h2>{editing.id ? 'Edit' : 'New'} Genre</h2>
            <div className="field"><label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-dark" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
