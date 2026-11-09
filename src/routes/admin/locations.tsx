import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { adminDeleteLocation, adminGetLocation, adminListLocations, adminLocationOptions, adminUpsertLocation } from '../../lib/admin'
import { type LocationInput } from '../../lib/locations-validation'
import { AdminDataTable } from '../../components/AdminDataTable'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminImagePreview } from '../../components/Poster'
import { UploadDialog } from '../../components/UploadDialog'
import '../../locations-admin.css'

export const Route = createFileRoute('/admin/locations')({
  loader: async () => {
    const [locations, titles] = await Promise.all([adminListLocations(), adminLocationOptions()])
    return { locations, titles }
  },
  component: LocationsPage,
})

const KIND: Record<string, string> = { movie: 'Sermon', tvshow: 'Show', teaching: 'Teaching', video: 'Video', episode: 'Episode' }
const keyFor = (item: { content_type: string; content_id?: number; id?: number }) => `${item.content_type}:${item.content_id ?? item.id}`

function LocationsPage() {
  const { locations, titles } = Route.useLoaderData()
  const { admin } = Route.useRouteContext()
  const router = useRouter()
  const notify = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<LocationInput | null>(null)
  const [busy, setBusy] = useState(false)
  const readonly = admin.user_type === 'demo_admin'

  async function edit(id: number) {
    setBusy(true)
    try { setEditing(await adminGetLocation({ data: id })) }
    catch (error) { notify({ title: 'Could not load location', description: (error as Error).message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  async function remove(id: number, name: string) {
    if (!await confirm({ title: `Delete ${name}?`, description: 'The location will be hidden from titles. Its saved associations are retained.', approveLabel: 'Delete' })) return
    setBusy(true)
    try {
      await adminDeleteLocation({ data: id })
      await router.invalidate()
      notify({ title: 'Location deleted', variant: 'success' })
    } catch (error) { notify({ title: 'Could not delete location', description: (error as Error).message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }

  return <div className="locations-admin">
    <div className="breadcrumb">Content <span className="sep">/</span><span className="here">Locations</span></div>
    <div className="toolbar"><p>Locations appear on the titles they are assigned to.</p><span className="spacer" />
      {!readonly && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setEditing({ name: '', status: 1, assignments: [] })}>+ New Location</button>}
    </div>
    <AdminDataTable rows={locations} busy={busy} searchable={['name', 'address']} columns={[
      { key: 'file_url', label: 'Location', kind: 'img' }, { key: 'address', label: 'Address' }, { key: 'titles', label: 'Titles' }, { key: 'status', label: 'Status', kind: 'pill' },
    ]} onEdit={readonly ? undefined : row => edit(row.id)} onDelete={readonly ? undefined : row => remove(row.id, row.name)} />
    {editing && <LocationEditor initial={editing} titles={titles} onClose={() => setEditing(null)} onSaved={async () => {
      setEditing(null); await router.invalidate(); notify({ title: 'Location saved', variant: 'success' })
    }} />}
  </div>
}

function LocationEditor({ initial, titles, onClose, onSaved }: { initial: LocationInput; titles: any[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(initial)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  busyRef.current = busy || uploading
  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => { element?.close(); trigger?.isConnected && trigger.focus() }
  }, [])
  const chosen = new Set(value.assignments.map(keyFor))
  const options = titles.filter(title => `${title.name} ${title.parent_name ?? ''} ${KIND[title.type] ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const missing = value.assignments.filter(item => !titles.some(title => keyFor(title) === keyFor(item)))

  async function save() {
    if (busy || uploading) return
    setBusy(true); setError('')
    try { await adminUpsertLocation({ data: value }); await onSaved() }
    catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  function toggle(title: any) {
    const key = keyFor(title)
    setValue(current => ({ ...current, assignments: chosen.has(key) ? current.assignments.filter(item => keyFor(item) !== key) : [...current.assignments, { content_type: title.content_type, content_id: title.id }] }))
  }

  return <dialog ref={dialog} className="location-editor" aria-labelledby="location-editor-title"
    onCancel={event => { event.preventDefault(); if (!busyRef.current) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !busyRef.current) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void save() }}>
      <header><h2 id="location-editor-title">{value.id ? 'Edit location' : 'New location'}</h2><button type="button" aria-label="Close location editor" disabled={busy || uploading} onClick={onClose}>×</button></header>
      <fieldset disabled={busy || uploading}>
        <label>Name<input autoFocus required maxLength={200} value={value.name} onChange={event => setValue({ ...value, name: event.target.value })} /></label>
        <label>Address<input maxLength={1000} value={value.address ?? ''} onChange={event => setValue({ ...value, address: event.target.value })} /></label>
        <label>Description<textarea rows={3} maxLength={20000} value={value.description ?? ''} onChange={event => setValue({ ...value, description: event.target.value })} /></label>
        <label>Image URL<input value={value.file_url ?? ''} onChange={event => setValue({ ...value, file_url: event.target.value })} placeholder="https://… or /media/…" /></label>
        <div className="location-image-upload"><button type="button" className="btn btn-dark" onClick={() => setUploading(true)}>Upload image</button><AdminImagePreview url={value.file_url} label="Location preview" className="img-preview-lg" /></div>
        <label>Status<select value={value.status} onChange={event => setValue({ ...value, status: Number(event.target.value) })}><option value={1}>Active</option><option value={0}>Inactive</option></select></label>
      </fieldset>
      <fieldset disabled={busy || uploading} className="location-title-field"><legend>Assigned titles ({value.assignments.length})</legend>
        <input type="search" aria-label="Search titles to assign" placeholder="Search sermons, shows, videos or episodes" value={query} onChange={event => setQuery(event.target.value)} />
        <div className="location-title-options">
          {options.map(title => <label key={keyFor(title)}><input type="checkbox" checked={chosen.has(keyFor(title))} onChange={() => toggle(title)} /><span>{title.name}<small>{KIND[title.type] ?? title.type}{title.parent_name ? ` · ${title.parent_name}` : ''}</small></span></label>)}
          {!options.length && <p>No matching titles.</p>}
        </div>
        {missing.map(item => <p key={keyFor(item)}>Unavailable {item.content_type} #{item.content_id} <button type="button" onClick={() => setValue(current => ({ ...current, assignments: current.assignments.filter(link => keyFor(link) !== keyFor(item)) }))}>Remove association</button></p>)}
      </fieldset>
      {error && <p className="location-editor-error" role="alert">{error}</p>}
      <footer><button type="button" className="btn btn-dark" disabled={busy || uploading} onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy || uploading}>{busy ? 'Saving…' : 'Save location'}</button></footer>
    </form>
    <UploadDialog open={uploading} title="Upload location image" accept="image/*" onClose={() => setUploading(false)} onUploaded={(url) => { setValue(current => ({ ...current, file_url: url })); setUploading(false) }} />
  </dialog>
}
