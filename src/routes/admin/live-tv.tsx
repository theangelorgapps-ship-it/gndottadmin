import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListChannels, adminUpsertChannel, adminDeleteChannel } from '../../lib/admin'
import { img } from '../../components/Poster'

export const Route = createFileRoute('/admin/live-tv')({
  loader: async () => await adminListChannels(),
  component: AdminLiveTv,
})

type CForm = { id?: number; name: string; category_id: number | ''; access: string; description: string; status: number }

function AdminLiveTv() {
  const { channels, categories } = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState<CForm | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    setBusy(true)
    await adminUpsertChannel({
      data: { ...editing, category_id: editing.category_id === '' ? undefined : Number(editing.category_id) },
    })
    setBusy(false)
    setEditing(null)
    router.invalidate()
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await adminDeleteChannel({ data: id })
    router.invalidate()
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Live TV</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', category_id: '', access: 'free', description: '', status: 1 })}>+ New Channel</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Channel</th><th>Category</th><th>Access</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
        <tbody>
          {channels.map((c: any) => (
            <tr key={c.id}>
              <td>
                <div className="cell-main">
                  <img src={img(c.poster_url)} alt="" style={{ width: 46, height: 46, borderRadius: 6 }} />
                  <span className="cell-title">{c.name}</span>
                </div>
              </td>
              <td>{c.category ?? '—'}</td>
              <td><span className={`pill ${c.access === 'free' ? 'info' : 'on'}`}>{c.access === 'free' ? 'Free' : 'Paid'}</span></td>
              <td><span className={`pill ${c.status == 1 ? 'on' : 'off'}`}>{c.status == 1 ? 'Active' : 'Off'}</span></td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => setEditing({
                    id: c.id, name: c.name, category_id: c.category_id ?? '', access: c.access ?? 'free',
                    description: c.description ?? '', status: c.status ?? 1,
                  })}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(c.id, c.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <div className="modal-back" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'New'} Channel</h2>
            <div className="field"><label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label>Category</label>
                <select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value === '' ? '' : Number(e.target.value) })}>
                  <option value="">— None —</option>
                  {categories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select></div>
              <div className="field"><label>Access</label>
                <select value={editing.access} onChange={(e) => setEditing({ ...editing, access: e.target.value })}>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select></div>
            </div>
            <div className="field"><label>Description</label>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
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
