import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListChannels, adminUpsertChannel, adminDeleteChannel } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminDataTable } from '../../components/AdminDataTable'

export const Route = createFileRoute('/admin/live-tv')({
  loader: async () => await adminListChannels(),
  component: AdminLiveTv,
})

type CForm = { id?: number; name: string; category_id: number | ''; access: string; description: string; status: number }

function AdminLiveTv() {
  const { channels, categories } = Route.useLoaderData()
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<CForm | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    setBusy(true)
    try {
      await adminUpsertChannel({
        data: { ...editing, category_id: editing.category_id === '' ? undefined : Number(editing.category_id) },
      })
      notify({ title: editing.id ? 'Channel updated' : 'Channel created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the channel.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number, name: string) {
    const ok = await confirmAction({
      title: `Delete "${name}"?`,
      description: 'The live channel will be removed from the app.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    try {
      await adminDeleteChannel({ data: id })
      notify({ title: 'Channel deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the channel.', variant: 'destructive' })
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Live TV</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', category_id: '', access: 'free', description: '', status: 1 })}>+ New Channel</button>
      </div>
      <AdminDataTable
        rows={channels}
        columns={[
          { key: 'poster_url', label: 'Channel', kind: 'img' },
          { key: 'category', label: 'Category' },
          { key: 'access', label: 'Access', kind: 'access' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        searchable={['name', 'category']}
        busy={busy}
        onEdit={(c) => setEditing({
          id: c.id, name: c.name, category_id: c.category_id ?? '', access: c.access ?? 'free',
          description: c.description ?? '', status: c.status ?? 1,
        })}
        onDelete={(c) => remove(c.id, c.name)}
      />
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
