import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { adminListGenres, adminUpsertGenre, adminDeleteGenre } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminDataTable } from '../../components/AdminDataTable'

export const Route = createFileRoute('/admin/genres')({
  loader: async () => await adminListGenres(),
  component: AdminGenres,
})

type GForm = { id?: number; name: string; status: number }

function AdminGenres() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<GForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitleId = useId()
  const dialogHelpId = useId()
  const editorOpen = editing !== null

  useEffect(() => {
    if (!editorOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => {
      if (dialog.open) dialog.close()
      setTimeout(() => {
        if (previousFocus?.isConnected) previousFocus.focus()
      }, 0)
    }
  }, [editorOpen])

  function openEditor(genre?: any) {
    setError(null)
    setEditing(genre
      ? { id: genre.id, name: genre.name, status: genre.status ?? 1 }
      : { name: '', status: 1 })
  }

  function requestClose() {
    if (busy) return
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing || busy) return
    if (!editing.name.trim()) {
      setError('Name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminUpsertGenre({ data: editing })
      notify({ title: editing.id ? 'Genre updated' : 'Genre created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
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
    setBusy(true)
    try {
      await adminDeleteGenre({ data: id })
      notify({ title: 'Genre deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the genre.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Genres</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Manage genres used to organize content.</span>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => openEditor()} disabled={busy}>+ New Genre</button>
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
        searchPlaceholder="Search genres…"
        empty="No genres found."
        busy={busy}
        onEdit={openEditor}
        onDelete={(genre) => remove(genre.id, genre.name)}
      />
      {editing && (
        <dialog
          ref={dialogRef}
          className="modal m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-5 sm:p-6 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogHelpId}
          aria-busy={busy}
          onCancel={(event) => {
            event.preventDefault()
            requestClose()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget || busy) return
            const rect = event.currentTarget.getBoundingClientRect()
            const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
            if (outside) requestClose()
          }}
        >
          <form className="min-w-0" noValidate onSubmit={(event) => { event.preventDefault(); void save() }}>
            <div className="mb-5">
              <h2 id={dialogTitleId} className="mb-1">{editing.id ? 'Edit' : 'New'} Genre</h2>
              <p id={dialogHelpId} className="text-sm text-muted-foreground">Fields marked * are required.</p>
            </div>
            <div className="modal-form">
              <div className="mfield span2">
                <label htmlFor="genre-name">Name <span aria-hidden="true">*</span></label>
                <input
                  id="genre-name"
                  data-initial-focus
                  value={editing.name}
                  disabled={busy}
                  aria-required="true"
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="mfield span2">
                <label htmlFor="genre-status">Status</label>
                <select
                  id="genre-status"
                  value={editing.status}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, status: Number(event.target.value) })}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
            </div>
            {error && <div className="error mt-3" role="alert">{error}</div>}
            <div className="modal-actions border-t border-border pt-4">
              <button type="button" className="btn btn-dark" onClick={requestClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  )
}
