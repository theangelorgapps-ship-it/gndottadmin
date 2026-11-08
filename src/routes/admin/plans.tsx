import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListPlans, adminUpsertPlan, adminDeletePlan } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminDataTable } from '../../components/AdminDataTable'

export const Route = createFileRoute('/admin/plans')({
  loader: async () => await adminListPlans(),
  component: AdminPlans,
})

type PForm = { id?: number; name: string; price: string; duration: string; duration_value: number; level: number; status: number; description: string }

function AdminPlans() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
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
      notify({ title: editing.id ? 'Plan updated' : 'Plan created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the plan.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number, name: string) {
    const ok = await confirmAction({
      title: `Delete plan "${name}"?`,
      description: 'Subscribers on this plan are not affected retroactively.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    try {
      await adminDeletePlan({ data: id })
      notify({ title: 'Plan deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the plan.', variant: 'destructive' })
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Plans</span></div>
      <p>Monthly plans include the owner and 1 invited email login with 5 pooled devices. Annual plans include the owner and 3 invited email logins with 10 pooled devices. Profiles stay private to each account; they do not count as shared members.</p>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', price: '', duration: 'month', duration_value: 1, level: 1, status: 1, description: '' })}>+ New Plan</button>
      </div>
      <AdminDataTable
        rows={items.map((p: any) => ({
          ...p,
          duration_label: `${p.duration_value} ${p.duration}${Number(p.duration_value) > 1 ? 's' : ''}`,
          sharing: p.duration === 'year' ? '4 email logins · 10 devices' : p.duration === 'month' ? '2 email logins · 5 devices' : '1 email login · 5 devices',
        }))}
        columns={[
          { key: 'name', label: 'Plan', kind: 'title' },
          { key: 'price', label: 'Price', kind: 'money' },
          { key: 'duration_label', label: 'Duration' },
          { key: 'sharing', label: 'Shared access (owner included)' },
          { key: 'level', label: 'Level' },
          { key: 'subscribers', label: 'Subscribers' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        searchable={['name', 'identifier']}
        busy={busy}
        onEdit={(p) => setEditing({
          id: p.id, name: p.name, price: String(p.price), duration: p.duration ?? 'month',
          duration_value: Number(p.duration_value ?? 1), level: Number(p.level ?? 1),
          status: p.status ?? 1, description: p.description ?? '',
        })}
        onDelete={(p) => remove(p.id, p.name)}
      />
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
