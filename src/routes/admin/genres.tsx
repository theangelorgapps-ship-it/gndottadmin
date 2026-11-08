import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListGenres, adminUpsertGenre, adminDeleteGenre } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminDataTable } from '../../components/AdminDataTable'

export const Route = createFileRoute('/admin/genres')({
  loader: async () => await adminListGenres(),
  component: AdminGenres,
})

function AdminGenres() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<{ id?: number; name: string; status: number } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    setBusy(true)
    try {
      await adminUpsertGenre({ data: editing })
      notify({ title: editing.id ? 'Genre updated' : 'Genre created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the genre.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number, name: string) {
    const ok = await confirmAction({
      title: `Delete genre "${name}"?`,
      description: 'Titles mapped to this genre will lose the association.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    try {
      await adminDeleteGenre({ data: id })
      notify({ title: 'Genre deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the genre.', variant: 'destructive' })
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Genres</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', status: 1 })}>+ New Genre</button>
      </div>
      <AdminDataTable
        rows={items}
        columns={[
          { key: 'name', label: 'Name', kind: 'title' },
          { key: 'slug', label: 'Slug' },
          { key: 'titles', label: 'Titles' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        searchable={['name', 'slug']}
        busy={busy}
        onEdit={(g) => setEditing({ id: g.id, name: g.name, status: g.status ?? 1 })}
        onDelete={(g) => remove(g.id, g.name)}
      />
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
