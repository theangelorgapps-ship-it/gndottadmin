import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
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

  function openEditor(channel?: any) {
    setError(null)
    setEditing(channel ? {
      id: channel.id,
      name: channel.name,
      category_id: channel.category_id ?? '',
      access: channel.access ?? 'free',
      description: channel.description ?? '',
      status: channel.status ?? 1,
    } : { name: '', category_id: '', access: 'free', description: '', status: 1 })
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
      await adminUpsertChannel({
        data: { ...editing, category_id: editing.category_id === '' ? undefined : Number(editing.category_id) },
      })
      notify({ title: editing.id ? 'Channel updated' : 'Channel created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
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
    setBusy(true)
    try {
      await adminDeleteChannel({ data: id })
      notify({ title: 'Channel deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the channel.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Live TV</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Manage live channels, categories, and access.</span>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => openEditor()} disabled={busy}>+ New Channel</button>
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
        searchPlaceholder="Search live channels…"
        empty="No live channels found."
        busy={busy}
        onEdit={openEditor}
        onDelete={(channel) => remove(channel.id, channel.name)}
      />
      {editing && (
        <dialog
          ref={dialogRef}
          className="modal modal-wide m-auto max-h-[calc(100dvh-2rem)] w-[min(45rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-5 sm:p-6 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
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
              <h2 id={dialogTitleId} className="mb-1">{editing.id ? 'Edit' : 'New'} Channel</h2>
              <p id={dialogHelpId} className="text-sm text-muted-foreground">Fields marked * are required.</p>
            </div>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="channel-name">Name <span aria-hidden="true">*</span></label>
                <input
                  id="channel-name"
                  data-initial-focus
                  value={editing.name}
                  disabled={busy}
                  aria-required="true"
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="channel-category">Category</label>
                <select
                  id="channel-category"
                  value={editing.category_id}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, category_id: event.target.value === '' ? '' : Number(event.target.value) })}
                >
                  <option value="">— None —</option>
                  {categories.map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="channel-access">Access</label>
                <select
                  id="channel-access"
                  value={editing.access}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, access: event.target.value })}
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="channel-status">Status</label>
                <select
                  id="channel-status"
                  value={editing.status}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, status: Number(event.target.value) })}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="channel-description">Description</label>
                <textarea
                  id="channel-description"
                  rows={3}
                  value={editing.description}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                />
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
