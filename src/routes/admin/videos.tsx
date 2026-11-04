import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListVideos, adminUpsertVideo, adminDeleteVideo } from '../../lib/admin'

export const Route = createFileRoute('/admin/videos')({
  loader: async () => await adminListVideos(),
  component: AdminVideos,
})

type VForm = { id?: number; name: string; description: string; duration: string; release_date: string; status: number }
const EMPTY: VForm = { name: '', description: '', duration: '', release_date: '', status: 1 }

function AdminVideos() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState<VForm | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    setBusy(true)
    await adminUpsertVideo({ data: editing })
    setBusy(false)
    setEditing(null)
    router.invalidate()
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await adminDeleteVideo({ data: id })
    router.invalidate()
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Videos</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ New Video</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Duration</th><th>Release</th><th>Rating</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
        <tbody>
          {items.map((v: any) => (
            <tr key={v.id}>
              <td><span className="cell-title">{v.name}</span></td>
              <td>{v.duration ?? '—'}</td>
              <td>{v.release_date ? String(v.release_date).slice(0, 10) : '—'}</td>
              <td>{v.IMDb_rating ?? '—'}</td>
              <td><span className={`pill ${v.status == 1 ? 'on' : 'off'}`}>{v.status == 1 ? 'Active' : 'Off'}</span></td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => setEditing({
                    id: v.id, name: v.name, description: '', duration: v.duration ?? '',
                    release_date: v.release_date ? String(v.release_date).slice(0, 10) : '', status: v.status ?? 1,
                  })}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(v.id, v.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <div className="modal-back" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'New'} Video</h2>
            <div className="field"><label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label>Description</label>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label>Duration</label>
                <input value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} /></div>
              <div className="field"><label>Release date</label>
                <input type="date" value={editing.release_date} onChange={(e) => setEditing({ ...editing, release_date: e.target.value })} /></div>
            </div>
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
