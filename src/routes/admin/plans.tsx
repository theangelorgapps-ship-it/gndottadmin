import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListPlans, adminUpsertPlan, adminDeletePlan } from '../../lib/admin'

export const Route = createFileRoute('/admin/plans')({
  loader: async () => await adminListPlans(),
  component: AdminPlans,
})

type PForm = { id?: number; name: string; price: string; duration: string; duration_value: number; level: number; status: number; description: string }

function AdminPlans() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState<PForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      await adminUpsertPlan({
        data: { ...editing, price: Number(editing.price), duration_value: Number(editing.duration_value), level: Number(editing.level) },
      })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete plan "${name}"?`)) return
    await adminDeletePlan({ data: id })
    router.invalidate()
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Plans</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', price: '', duration: 'month', duration_value: 1, level: 1, status: 1, description: '' })}>+ New Plan</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Plan</th><th>Price</th><th>Duration</th><th>Level</th><th>Subscribers</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
        <tbody>
          {items.map((p: any) => (
            <tr key={p.id}>
              <td><span className="cell-title">{p.name}</span><div className="cell-sub">{p.identifier}</div></td>
              <td>${Number(p.price).toFixed(2)}</td>
              <td>{p.duration_value} {p.duration}{Number(p.duration_value) > 1 ? 's' : ''}</td>
              <td>{p.level}</td>
              <td>{p.subscribers}</td>
              <td><span className={`pill ${p.status == 1 ? 'on' : 'off'}`}>{p.status == 1 ? 'Active' : 'Off'}</span></td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => setEditing({
                    id: p.id, name: p.name, price: String(p.price), duration: p.duration ?? 'month',
                    duration_value: Number(p.duration_value ?? 1), level: Number(p.level ?? 1),
                    status: p.status ?? 1, description: '',
                  })}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(p.id, p.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <div className="modal-back" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'New'} Plan</h2>
            <div className="field"><label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label>Price (USD)</label>
                <input type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              <div className="field"><label>Level</label>
                <input type="number" min="1" value={editing.level} onChange={(e) => setEditing({ ...editing, level: Number(e.target.value) })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Duration</label>
                <select value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: e.target.value })}>
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                  <option value="year">Years</option>
                </select></div>
              <div className="field"><label>Duration value</label>
                <input type="number" min="1" value={editing.duration_value} onChange={(e) => setEditing({ ...editing, duration_value: Number(e.target.value) })} /></div>
            </div>
            <div className="field"><label>Description</label>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            {error && <div className="error">{error}</div>}
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
