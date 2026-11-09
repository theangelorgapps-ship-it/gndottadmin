import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { adminListVideos, adminUpsertVideo, adminDeleteVideo, adminGetVideo } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminDataTable } from '../../components/AdminDataTable'
import { AdminImagePreview } from '../../components/Poster'
import { UploadButton, BunnyUploadButton } from '../../components/admin-content'
import { RichTextEditor } from '../../components/RichTextEditor'

export const Route = createFileRoute('/admin/videos')({
  loader: async () => await adminListVideos(),
  component: AdminVideos,
})

type VForm = {
  id?: number; name: string; description: string; duration: string; release_date: string; status: number
  poster_url?: string; thumbnail_url?: string; trailer_url?: string; video_url_input?: string
  bunny_video_url?: string; access?: string; price?: number | null
  enable_subtitle?: number; subtitle_file?: string; subtitle_language?: string
  meta_title?: string; meta_keywords?: string; meta_description?: string
}

const EMPTY: VForm = { name: '', description: '', duration: '', release_date: '', status: 1, access: 'free' }

function Field({ id, label, children, span = false }: { id: string; label: string; children: ReactNode; span?: boolean }) {
  return (
    <div className="field min-w-0" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

function AdminVideos() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<VForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeUploads, setActiveUploads] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitleId = useId()
  const dialogHelpId = useId()
  const editorOpen = editing !== null
  const isBusy = busy || activeUploads > 0

  const handleUploadBusy = useCallback((uploadBusy: boolean) => {
    setActiveUploads((current) => Math.max(0, current + (uploadBusy ? 1 : -1)))
  }, [])

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

  async function openEdit(id: number) {
    setBusy(true)
    setError(null)
    try {
      const row: any = await adminGetVideo({ data: id })
      setEditing({
        id: row.id, name: row.name, description: row.description ?? '', duration: row.duration ?? '',
        release_date: row.release_date ? String(row.release_date).slice(0, 10) : '', status: row.status ?? 1,
        poster_url: row.poster_url ?? '', thumbnail_url: row.thumbnail_url ?? '', trailer_url: row.trailer_url ?? '',
        video_url_input: row.video_url_input ?? '', bunny_video_url: row.bunny_video_url ?? '',
        access: row.access ?? 'free', price: row.price,
        enable_subtitle: row.enable_subtitle ?? 0, subtitle_file: row.subtitle_file ?? '', subtitle_language: row.subtitle_language ?? '',
        meta_title: row.meta_title ?? '', meta_keywords: row.meta_keywords ?? '', meta_description: row.meta_description ?? '',
      })
    } catch (e: any) {
      notify({ title: 'Could not load record', description: e?.message ?? 'Please try again.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function openNew() {
    setError(null)
    setEditing({ ...EMPTY })
  }

  function requestClose() {
    if (isBusy) return
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing || isBusy) return
    if (!editing.name.trim()) {
      setError('Name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminUpsertVideo({ data: editing })
      notify({ title: editing.id ? 'Video updated' : 'Video created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the video.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number, name: string) {
    const ok = await confirmAction({
      title: `Delete "${name}"?`,
      description: 'The video and its stream mapping will be removed.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeleteVideo({ data: id })
      notify({ title: 'Video deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the video.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Partial<VForm>) => setEditing((current) => (current ? { ...current, ...patch } : current))

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Videos</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Manage videos, streams, subtitles, and publishing details.</span>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={openNew} disabled={busy}>+ New Video</button>
      </div>
      <AdminDataTable
        rows={items}
        columns={[
          { key: 'poster_url', label: 'Video', kind: 'img' },
          { key: 'duration', label: 'Duration' },
          { key: 'release_date', label: 'Release', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        searchable={['name']}
        searchPlaceholder="Search videos…"
        empty="No videos found."
        busy={busy}
        onEdit={(video) => openEdit(video.id)}
        onDelete={(video) => remove(video.id, video.name)}
      />
      {editing && (
        <dialog
          ref={dialogRef}
          className="modal modal-wide m-auto max-h-[calc(100dvh-2rem)] w-[min(45rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-5 sm:p-6 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogHelpId}
          aria-busy={isBusy}
          onCancel={(event) => {
            event.preventDefault()
            requestClose()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget || isBusy) return
            const rect = event.currentTarget.getBoundingClientRect()
            const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
            if (outside) requestClose()
          }}
        >
          <form className="min-w-0" noValidate onSubmit={(event) => { event.preventDefault(); void save() }}>
            <div className="mb-5">
              <h2 id={dialogTitleId} className="mb-1">{editing.id ? 'Edit' : 'New'} Video</h2>
              <p id={dialogHelpId} className="text-sm text-muted-foreground">Fields marked * are required. Your changes are not saved until you select Save.</p>
            </div>
            <div className="form-grid">
              <Field id="video-name" label="Name *" span>
                <input id="video-name" data-initial-focus value={editing.name} disabled={busy} aria-required="true" onChange={(event) => set({ name: event.target.value })} />
              </Field>
              <Field id="video-description" label="Description" span>
                <RichTextEditor id="video-description" label="Description" value={editing.description ?? ''} disabled={busy} onChange={html => set({ description: html })} />
              </Field>
              <Field id="video-duration" label="Duration">
                <input id="video-duration" value={editing.duration} disabled={busy} onChange={(event) => set({ duration: event.target.value })} />
              </Field>
              <Field id="video-release-date" label="Release date">
                <input id="video-release-date" type="date" value={editing.release_date} disabled={busy} onChange={(event) => set({ release_date: event.target.value })} />
              </Field>
              <Field id="video-status" label="Status">
                <select id="video-status" value={editing.status} disabled={busy} onChange={(event) => set({ status: Number(event.target.value) })}>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </Field>
              <Field id="video-access" label="Access">
                <select id="video-access" value={editing.access ?? 'free'} disabled={busy} onChange={(event) => set({ access: event.target.value })}>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </Field>
              <Field id="video-price" label="Price ($)">
                <input id="video-price" type="number" step="0.01" value={editing.price ?? ''} disabled={busy} onChange={(event) => set({ price: event.target.value ? Number(event.target.value) : null })} />
              </Field>
              <Field id="video-bunny" label="Bunny Stream Video ID" span>
                <div className="img-field">
                  <input id="video-bunny" placeholder="Paste a Bunny video ID, link, or iframe embed" value={editing.bunny_video_url ?? ''} disabled={busy} onChange={(event) => set({ bunny_video_url: event.target.value })} />
                  <BunnyUploadButton table="videos" contentId={editing.id} title={editing.name} parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(videoId) => set({ bunny_video_url: videoId })} />
                </div>
              </Field>
              <Field id="video-trailer" label="Trailer URL (YouTube)">
                <input id="video-trailer" value={editing.trailer_url ?? ''} disabled={busy} onChange={(event) => set({ trailer_url: event.target.value })} />
              </Field>
              <Field id="video-external" label="External video URL">
                <input id="video-external" value={editing.video_url_input ?? ''} disabled={busy} onChange={(event) => set({ video_url_input: event.target.value })} />
              </Field>
              <Field id="video-poster" label="Poster URL">
                <div className="img-field"><input id="video-poster" value={editing.poster_url ?? ''} disabled={busy} onChange={(event) => set({ poster_url: event.target.value })} /><UploadButton label="Poster" currentValue={editing.poster_url} parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ poster_url: url })} /></div>
                <AdminImagePreview url={editing.poster_url} label="Poster preview" className="img-preview-lg" />
              </Field>
              <Field id="video-thumbnail" label="Thumbnail URL">
                <div className="img-field"><input id="video-thumbnail" value={editing.thumbnail_url ?? ''} disabled={busy} onChange={(event) => set({ thumbnail_url: event.target.value })} /><UploadButton label="Thumbnail" currentValue={editing.thumbnail_url} parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ thumbnail_url: url })} /></div>
                <AdminImagePreview url={editing.thumbnail_url} label="Thumbnail preview" className="img-preview-lg" />
              </Field>
              <Field id="video-subtitles" label="Subtitles">
                <select id="video-subtitles" value={editing.enable_subtitle ?? 0} disabled={busy} onChange={(event) => set({ enable_subtitle: Number(event.target.value) })}>
                  <option value={0}>Off</option>
                  <option value={1}>On</option>
                </select>
              </Field>
              <Field id="video-subtitle-language" label="Subtitle language">
                <input id="video-subtitle-language" value={editing.subtitle_language ?? ''} disabled={busy} onChange={(event) => set({ subtitle_language: event.target.value })} />
              </Field>
              <Field id="video-subtitle-file" label="Subtitle file" span>
                <div className="img-field"><input id="video-subtitle-file" value={editing.subtitle_file ?? ''} disabled={busy} onChange={(event) => set({ subtitle_file: event.target.value })} /><UploadButton label="Subtitle" currentValue={editing.subtitle_file} accept=".vtt,.srt" parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ subtitle_file: url })} /></div>
              </Field>
              <Field id="video-meta-title" label="Meta title (SEO)" span>
                <input id="video-meta-title" value={editing.meta_title ?? ''} disabled={busy} onChange={(event) => set({ meta_title: event.target.value })} />
              </Field>
              <Field id="video-meta-keywords" label="Meta keywords (SEO)" span>
                <input id="video-meta-keywords" value={editing.meta_keywords ?? ''} disabled={busy} onChange={(event) => set({ meta_keywords: event.target.value })} />
              </Field>
              <Field id="video-meta-description" label="Meta description (SEO)" span>
                <textarea id="video-meta-description" rows={2} value={editing.meta_description ?? ''} disabled={busy} onChange={(event) => set({ meta_description: event.target.value })} />
              </Field>
            </div>
            {error && <div className="error mt-3" role="alert">{error}</div>}
            <div className="modal-actions border-t border-border pt-4">
              <button type="button" className="btn btn-dark" onClick={requestClose} disabled={isBusy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isBusy} aria-disabled={isBusy}>
                {busy ? 'Saving…' : activeUploads > 0 ? 'Waiting for upload…' : 'Save'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  )
}
