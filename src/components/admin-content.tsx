import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  adminUpsertContent, adminDeleteContent, adminGetContent, adminContentOptions, type ContentInput,
} from '../lib/admin'
import { useConfirm } from '../lib/confirm'
import { useToast } from '../lib/toast'
import { AdminDataTable } from './AdminDataTable'
import { AdminImagePreview } from './Poster'
import { UploadDialog } from './UploadDialog'
import { orderPersonalities } from './CrudTable'

const TYPE_LABEL = { movie: 'Sermon', tvshow: 'Show', teaching: 'Teaching' } as const

// Stored values remain in create/edit payloads even though review-oriented UI is hidden.
const EMPTY: ContentInput = {
  name: '', type: 'movie', description: '', release_date: '', language: 'english',
  movie_access: 'free', content_rating: '', IMDb_rating: '', duration: '', status: 1,
}

function Field({
  id,
  label,
  children,
  span,
  help,
}: {
  id: string
  label: string
  children: ReactNode
  span?: boolean
  help?: string
}) {
  return (
    <div className="field min-w-0" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {help && <small className="block text-xs leading-5 text-muted-foreground">{help}</small>}
    </div>
  )
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="field m-0 min-w-0 border-0 p-0" style={{ gridColumn: '1 / -1' }}>
      <legend className="mb-2 text-xs font-semibold text-muted-foreground">{label}</legend>
      {children}
    </fieldset>
  )
}

type UploadButtonProps = {
  onDone: (url: string) => void
  accept?: string
  label: string
  parentBusy?: boolean
  onBusyChange?: (busy: boolean) => void
}

export function UploadButton({ onDone, accept, label, parentBusy = false, onBusyChange }: UploadButtonProps) {
  const [open, setOpen] = useState(false)
  function close() { setOpen(false); onBusyChange?.(false) }
  return <>
    <button type="button" className="btn btn-dark btn-sm upload-btn" disabled={parentBusy || open} onClick={() => { setOpen(true); onBusyChange?.(true) }}>Upload {label.toLowerCase()}</button>
    <UploadDialog open={open} onClose={close} onUploaded={(url) => { onDone(url); close() }} accept={accept ?? 'image/*'} title={`Upload ${label.toLowerCase()}`} />
  </>
}

export function BunnyUploadButton({ contentId, title, onDone, parentBusy = false, onBusyChange, table = 'entertainments' }: {
  contentId?: number
  title: string
  onDone: (videoId: string) => void
  parentBusy?: boolean
  onBusyChange?: (busy: boolean) => void
  table?: 'entertainments' | 'videos'
}) {
  const [open, setOpen] = useState(false)
  function close() { setOpen(false); onBusyChange?.(false) }
  return <>
    <button type="button" className="btn btn-dark btn-sm upload-btn" disabled={parentBusy || open} onClick={() => { setOpen(true); onBusyChange?.(true) }}>Upload to Bunny Stream</button>
    <UploadDialog open={open} onClose={close} onUploaded={(videoId) => { onDone(videoId); close() }} accept="video/*" title="Upload to Bunny Stream" target={{ endpoint: '/api/bunny-upload', title, table, rowId: contentId }} />
  </>
}

const FORM_TABS = [
  { key: 'general', label: 'General' },
  { key: 'media', label: 'Media & Video' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'seo', label: 'SEO' },
  { key: 'cast', label: 'People & categories' },
] as const

export function ContentAdmin({ items, type, title }: { items: any[]; type: 'movie' | 'tvshow' | 'teaching'; title: string }) {
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<ContentInput | null>(null)
  const [formTab, setFormTab] = useState<(typeof FORM_TABS)[number]['key']>('general')
  const [options, setOptions] = useState<{ genres: any[]; cast: any[]; plans: any[]; locations: any[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeUploads, setActiveUploads] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitleId = useId()
  const dialogHelpId = useId()
  const itemLabel = TYPE_LABEL[type]
  const collectionTitle = type === 'teaching' ? 'Teachings' : title
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
      // Wait for busy actions to re-enable after a successful save before returning focus.
      setTimeout(() => {
        if (previousFocus?.isConnected) previousFocus.focus()
      }, 0)
    }
  }, [editorOpen])

  useEffect(() => {
    if (!editorOpen || options) return
    let cancelled = false
    adminContentOptions()
      .then((value: any) => {
        if (!cancelled) setOptions(value)
      })
      .catch((loadError: any) => {
        if (!cancelled) notify({ title: 'Could not load form options', description: loadError?.message ?? 'Please try again.', variant: 'destructive' })
      })
    return () => { cancelled = true }
  }, [editorOpen, options, notify])

  async function openEdit(id: number) {
    setBusy(true)
    setError(null)
    try {
      const row: any = await adminGetContent({ data: id })
      setEditing({ ...row, type })
      setFormTab('general')
    } catch (e: any) {
      notify({ title: 'Could not load record', description: e?.message ?? 'Please try again.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function openNew() {
    setError(null)
    setEditing({ ...EMPTY, type })
    setFormTab('general')
  }

  function requestClose() {
    if (isBusy) return
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing || isBusy) return
    setBusy(true)
    setError(null)
    try {
      await adminUpsertContent({ data: { ...editing, type } })
      notify({ title: editing.id ? `${itemLabel} updated` : `${itemLabel} created`, description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the record.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number, name: string) {
    const ok = await confirmAction({
      title: `Delete "${name}"?`,
      description: 'This can be undone from the database.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeleteContent({ data: id })
      notify({ title: `${itemLabel} deleted`, description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the record.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Partial<ContentInput>) => setEditing((current) => current ? { ...current, ...patch } : current)
  const personalities = orderPersonalities(options?.cast ?? [])

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (isBusy) return
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % FORM_TABS.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + FORM_TABS.length) % FORM_TABS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = FORM_TABS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    setFormTab(FORM_TABS[nextIndex].key)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">{collectionTitle}</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Manage {collectionTitle.toLowerCase()}, media, access, and publishing details.</span>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={openNew} disabled={busy}>+ New {itemLabel}</button>
      </div>
      <AdminDataTable
        rows={items}
        columns={[
          { key: 'poster_url', label: itemLabel, kind: 'img' },
          { key: 'movie_access', label: 'Access', kind: 'access' },
          { key: 'language', label: 'Language' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        busy={busy}
        searchable={['name']}
        searchPlaceholder={`Search ${collectionTitle.toLowerCase()}…`}
        empty={`No ${collectionTitle.toLowerCase()} found.`}
        onEdit={(item) => openEdit(item.id)}
        onDelete={(item) => remove(item.id, item.name)}
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
            // Native dialog cancel covers Escape; active saves/uploads stay open.
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
          <form
            className="min-w-0"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="mb-4">
              <h2 id={dialogTitleId} className="mb-1">{editing.id ? 'Edit' : 'New'} {itemLabel}</h2>
              <p id={dialogHelpId} className="text-sm text-muted-foreground">Move between sections to edit this record, then select Save.</p>
            </div>
            <div className="tabs mb-5" role="tablist" aria-label={`${itemLabel} editor sections`}>
              {FORM_TABS.map((tab, index) => (
                <button
                  type="button"
                  key={tab.key}
                  id={`content-tab-${tab.key}`}
                  role="tab"
                  aria-selected={formTab === tab.key}
                  aria-controls={`content-panel-${tab.key}`}
                  tabIndex={formTab === tab.key ? 0 : -1}
                  className={formTab === tab.key ? 'active' : ''}
                  disabled={isBusy}
                  onClick={() => setFormTab(tab.key)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {formTab === 'general' && (
              <div className="form-grid" id="content-panel-general" role="tabpanel" aria-labelledby="content-tab-general">
                <Field id="content-name" label="Name" span>
                  <input id="content-name" data-initial-focus value={editing.name} disabled={busy} onChange={(event) => set({ name: event.target.value })} />
                </Field>
                <Field id="content-short-description" label="Short description" span>
                  <input id="content-short-description" value={editing.short_description ?? ''} disabled={busy} onChange={(event) => set({ short_description: event.target.value })} />
                </Field>
                <Field id="content-description" label="Description" span>
                  <textarea id="content-description" rows={3} value={editing.description ?? ''} disabled={busy} onChange={(event) => set({ description: event.target.value })} />
                </Field>
                <Field id="content-release-date" label="Release date">
                  <input id="content-release-date" type="date" value={editing.release_date ? String(editing.release_date).slice(0, 10) : ''} disabled={busy} onChange={(event) => set({ release_date: event.target.value })} />
                </Field>
                <Field id="content-language" label="Language">
                  <input id="content-language" value={editing.language ?? ''} disabled={busy} onChange={(event) => set({ language: event.target.value })} />
                </Field>
                <Field id="content-duration" label="Duration">
                  <input id="content-duration" placeholder="02h 30m" value={editing.duration ?? ''} disabled={busy} onChange={(event) => set({ duration: event.target.value })} />
                </Field>
                <Field id="content-status" label="Status">
                  <select id="content-status" value={editing.status ?? 1} disabled={busy} onChange={(event) => set({ status: Number(event.target.value) })}>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </Field>
                <Field id="content-restricted" label="Age restricted">
                  <select id="content-restricted" value={editing.is_restricted ?? 0} disabled={busy} onChange={(event) => set({ is_restricted: Number(event.target.value) })}>
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </Field>
              </div>
            )}

            {formTab === 'media' && (
              <div className="form-grid" id="content-panel-media" role="tabpanel" aria-labelledby="content-tab-media">
                <Field
                  id="content-bunny-video"
                  label="Bunny Stream Video ID"
                  span
                  help="Paste an existing Bunny video to reuse it. Upload only when adding a new video."
                >
                  <div className="img-field">
                    <input
                      id="content-bunny-video"
                      placeholder="Paste a Bunny video ID, link, or iframe embed"
                      value={editing.bunny_video_url ?? ''}
                      disabled={busy}
                      onChange={(event) => set({ bunny_video_url: event.target.value })}
                    />
                    <BunnyUploadButton contentId={editing.id} title={editing.name} parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(videoId) => set({ bunny_video_url: videoId })} />
                  </div>
                </Field>
                <Field id="content-bunny-trailer" label="Bunny Trailer Video ID">
                  <input id="content-bunny-trailer" value={editing.bunny_trailer_url ?? ''} disabled={busy} onChange={(event) => set({ bunny_trailer_url: event.target.value })} />
                </Field>
                <Field id="content-trailer-url" label="Trailer URL (YouTube)">
                  <input id="content-trailer-url" value={editing.trailer_url ?? ''} disabled={busy} onChange={(event) => set({ trailer_url: event.target.value })} />
                </Field>
                <Field id="content-video-url" label="Video URL (external/HLS)">
                  <input id="content-video-url" value={editing.video_url_input ?? ''} disabled={busy} onChange={(event) => set({ video_url_input: event.target.value })} />
                </Field>
                <Field id="content-quality" label="Enable quality variants">
                  <select id="content-quality" value={editing.enable_quality ?? 0} disabled={busy} onChange={(event) => set({ enable_quality: Number(event.target.value) })}>
                    <option value={0}>Off</option>
                    <option value={1}>On</option>
                  </select>
                </Field>
                <Field id="content-poster" label="Poster" span>
                  <div className="img-field-col">
                    <div className="img-field">
                      <input id="content-poster" value={editing.poster_url ?? ''} disabled={busy} onChange={(event) => set({ poster_url: event.target.value })} />
                      <UploadButton label="Poster" parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ poster_url: url })} />
                    </div>
                    <AdminImagePreview url={editing.poster_url} label="Poster preview" className="img-preview-lg" />
                  </div>
                </Field>
                <Field id="content-thumbnail" label="Thumbnail" span>
                  <div className="img-field-col">
                    <div className="img-field">
                      <input id="content-thumbnail" value={editing.thumbnail_url ?? ''} disabled={busy} onChange={(event) => set({ thumbnail_url: event.target.value })} />
                      <UploadButton label="Thumbnail" parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ thumbnail_url: url })} />
                    </div>
                    <AdminImagePreview url={editing.thumbnail_url} label="Thumbnail preview" className="img-preview-lg" />
                  </div>
                </Field>
                <Field id="content-subtitles" label="Enable subtitles">
                  <select id="content-subtitles" value={editing.enable_subtitle ?? 0} disabled={busy} onChange={(event) => set({ enable_subtitle: Number(event.target.value) })}>
                    <option value={0}>Off</option>
                    <option value={1}>On</option>
                  </select>
                </Field>
                <Field id="content-subtitle-language" label="Subtitle language">
                  <input id="content-subtitle-language" placeholder="english" value={editing.subtitle_language ?? ''} disabled={busy} onChange={(event) => set({ subtitle_language: event.target.value })} />
                </Field>
                <Field id="content-subtitle-file" label="Subtitle file (.vtt/.srt)" span>
                  <div className="img-field">
                    <input id="content-subtitle-file" value={editing.subtitle_file ?? ''} disabled={busy} onChange={(event) => set({ subtitle_file: event.target.value })} />
                    <UploadButton label="Subtitle" accept=".vtt,.srt" parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ subtitle_file: url })} />
                  </div>
                </Field>
              </div>
            )}

            {formTab === 'pricing' && (
              <div className="form-grid" id="content-panel-pricing" role="tabpanel" aria-labelledby="content-tab-pricing">
                <Field id="content-access" label="Access">
                  <select id="content-access" value={editing.movie_access ?? 'free'} disabled={busy} onChange={(event) => set({ movie_access: event.target.value })}>
                    <option value="free">Free</option>
                    <option value="paid">Paid (pay-per-view)</option>
                  </select>
                </Field>
                <Field id="content-plan" label="Plan (subscription gated)">
                  <select id="content-plan" value={editing.plan_id ?? ''} disabled={busy} onChange={(event) => set({ plan_id: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">None</option>
                    {(options?.plans ?? []).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </Field>
                <Field id="content-price" label="Price ($)">
                  <input id="content-price" type="number" step="0.01" value={editing.price ?? ''} disabled={busy} onChange={(event) => set({ price: event.target.value ? Number(event.target.value) : null })} />
                </Field>
                <Field id="content-discount" label="Discount (%)">
                  <input id="content-discount" type="number" value={editing.discount ?? ''} disabled={busy} onChange={(event) => set({ discount: event.target.value ? Number(event.target.value) : null })} />
                </Field>
                <Field id="content-purchase-type" label="Purchase type">
                  <select id="content-purchase-type" value={editing.purchase_type ?? 'rental'} disabled={busy} onChange={(event) => set({ purchase_type: event.target.value })}>
                    <option value="rental">Rental</option>
                    <option value="purchase">Purchase</option>
                  </select>
                </Field>
                <Field id="content-access-duration" label="Access duration (days)">
                  <input id="content-access-duration" type="number" value={editing.access_duration ?? ''} disabled={busy} onChange={(event) => set({ access_duration: event.target.value ? Number(event.target.value) : null })} />
                </Field>
                <Field id="content-available-for" label="Available for">
                  <input id="content-available-for" placeholder="e.g. 30 days" value={editing.available_for ?? ''} disabled={busy} onChange={(event) => set({ available_for: event.target.value })} />
                </Field>
              </div>
            )}

            {formTab === 'seo' && (
              <div className="form-grid" id="content-panel-seo" role="tabpanel" aria-labelledby="content-tab-seo">
                <Field id="content-meta-title" label="Meta title" span>
                  <input id="content-meta-title" value={editing.meta_title ?? ''} disabled={busy} onChange={(event) => set({ meta_title: event.target.value })} />
                </Field>
                <Field id="content-meta-keywords" label="Meta keywords" span>
                  <input id="content-meta-keywords" value={editing.meta_keywords ?? ''} disabled={busy} onChange={(event) => set({ meta_keywords: event.target.value })} />
                </Field>
                <Field id="content-meta-description" label="Meta description" span>
                  <textarea id="content-meta-description" rows={3} value={editing.meta_description ?? ''} disabled={busy} onChange={(event) => set({ meta_description: event.target.value })} />
                </Field>
                <Field id="content-seo-image" label="SEO image" span>
                  <div className="img-field-col">
                    <div className="img-field">
                      <input id="content-seo-image" value={editing.seo_image ?? ''} disabled={busy} onChange={(event) => set({ seo_image: event.target.value })} />
                      <UploadButton label="SEO image" parentBusy={busy} onBusyChange={handleUploadBusy} onDone={(url) => set({ seo_image: url })} />
                    </div>
                    <AdminImagePreview url={editing.seo_image} label="SEO image preview" className="img-preview-lg" />
                  </div>
                </Field>
              </div>
            )}

            {formTab === 'cast' && (
              <div className="form-grid" id="content-panel-cast" role="tabpanel" aria-labelledby="content-tab-cast">
                <ChoiceGroup label="Categories">
                  <div className="check-grid" role="group" aria-label="Categories">
                    {(options?.genres ?? []).map((genre) => (
                      <label key={genre.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={(editing.genre_ids ?? []).includes(genre.id)}
                          disabled={busy}
                          onChange={(event) => {
                            const current = editing.genre_ids ?? []
                            set({ genre_ids: event.target.checked ? [...current, genre.id] : current.filter((id) => id !== genre.id) })
                          }}
                        />
                        {genre.name}
                      </label>
                    ))}
                    {options && options.genres.length === 0 && <p className="text-sm text-muted-foreground">No categories are available.</p>}
                  </div>
                </ChoiceGroup>
                <ChoiceGroup label="Personalities">
                  <div className="check-grid" role="group" aria-label="Personalities">
                    {personalities.map((person) => (
                      <label key={person.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={(person.type === 'director' ? editing.director_ids ?? [] : editing.cast_ids ?? []).includes(person.id)}
                          disabled={busy}
                          onChange={(event) => {
                            const key = person.type === 'director' ? 'director_ids' : 'cast_ids'
                            const current = editing[key] ?? []
                            set({ [key]: event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id) })
                          }}
                        />
                        {person.name}
                      </label>
                    ))}
                    {options && personalities.length === 0 && <p className="text-sm text-muted-foreground">No personalities are available.</p>}
                  </div>
                </ChoiceGroup>
                <ChoiceGroup label="Locations">
                  <div className="check-grid" role="group" aria-label="Locations">
                    {(options?.locations ?? []).map((person) => (
                      <label key={person.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={(editing.location_ids ?? []).includes(person.id)}
                          disabled={busy}
                          onChange={(event) => {
                            const current = editing.location_ids ?? []
                            set({ location_ids: event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id) })
                          }}
                        />
                        {person.name}
                      </label>
                    ))}
                    {options && (options.locations ?? []).length === 0 && <p className="text-sm text-muted-foreground">No locations are available. <Link to="/admin/locations">Manage locations</Link></p>}
                  </div>
                </ChoiceGroup>
                {!options && <p className="text-sm text-muted-foreground" role="status" style={{ gridColumn: '1 / -1' }}>Loading categories, personalities, and locations…</p>}
              </div>
            )}

            {error && <div className="error" role="alert">{error}</div>}
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
