import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  adminUpsertContent, adminDeleteContent, adminGetContent, adminContentOptions, type ContentInput,
} from '../lib/admin'
import { img } from './Poster'

const EMPTY: ContentInput = {
  name: '', type: 'movie', description: '', release_date: '', language: 'english',
  movie_access: 'free', content_rating: '', IMDb_rating: '', duration: '', status: 1,
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className="field" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  )
}

function UploadButton({ onDone, accept }: { onDone: (url: string) => void; accept?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <label className="btn btn-dark btn-xs" style={{ cursor: 'pointer' }}>
      {busy ? 'Uploading…' : 'Upload'}
      <input
        type="file"
        accept={accept ?? 'image/*'}
        style={{ display: 'none' }}
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          setBusy(true)
          const fd = new FormData()
          fd.append('file', f)
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          const json: any = await res.json().catch(() => null)
          setBusy(false)
          if (json?.ok) onDone(json.url)
          else alert(json?.error ?? 'Upload failed')
          e.target.value = ''
        }}
      />
    </label>
  )
}

function BunnyUploadButton({
  contentId, title, onDone,
}: { contentId?: number; title: string; onDone: (videoId: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  return (
    <label className="btn btn-dark btn-xs" style={{ cursor: 'pointer' }}>
      {busy ? (progress ?? 'Uploading to Bunny…') : 'Upload to Bunny Stream'}
      <input
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          setBusy(true)
          setProgress(`Uploading ${(f.size / 1024 / 1024).toFixed(1)} MB…`)
          const fd = new FormData()
          fd.append('file', f)
          fd.append('title', title || f.name)
          if (contentId) {
            fd.append('table', 'entertainments')
            fd.append('row_id', String(contentId))
          }
          const res = await fetch('/api/bunny-upload', { method: 'POST', body: fd })
          const json: any = await res.json().catch(() => null)
          setBusy(false)
          setProgress(null)
          if (json?.ok) onDone(json.videoId)
          else alert(json?.error ?? 'Bunny upload failed')
          e.target.value = ''
        }}
      />
    </label>
  )
}

const FORM_TABS = [
  { key: 'general', label: 'General' },
  { key: 'media', label: 'Media & Video' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'seo', label: 'SEO' },
  { key: 'cast', label: 'Cast & Genres' },
]

export function ContentAdmin({ items, type, title }: { items: any[]; type: 'movie' | 'tvshow'; title: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ContentInput | null>(null)
  const [formTab, setFormTab] = useState('general')
  const [options, setOptions] = useState<{ genres: any[]; cast: any[]; plans: any[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = items.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (editing && !options) adminContentOptions().then((o: any) => setOptions(o)).catch(() => null)
  }, [editing])

  async function openEdit(id: number) {
    setError(null)
    try {
      const row: any = await adminGetContent({ data: id })
      setEditing({ ...row, type })
      setFormTab('general')
    } catch (e: any) {
      alert(e?.message ?? 'Could not load record.')
    }
  }

  async function save() {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      await adminUpsertContent({ data: { ...editing, type } })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This can be undone from the database.`)) return
    await adminDeleteContent({ data: id })
    router.invalidate()
  }

  const set = (patch: Partial<ContentInput>) => setEditing((cur) => (cur ? { ...cur, ...patch } : cur))
  const actors = options?.cast.filter((c) => c.type !== 'director') ?? []
  const directors = options?.cast.filter((c) => c.type === 'director') ?? []

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">{title}</span></div>
      <div className="toolbar">
        <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => { setEditing({ ...EMPTY, type }); setFormTab('general') }}>+ New {type === 'movie' ? 'Movie' : 'TV Show'}</button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{type === 'movie' ? 'Movie' : 'TV Show'}</th>
            <th>Access</th><th>Language</th><th>Rating</th><th>Status</th><th style={{ width: 150 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id}>
              <td>
                <div className="cell-main">
                  <img src={img(m.poster_url)} alt="" />
                  <div>
                    <div className="cell-title">{m.name}</div>
                    <div className="cell-sub">{m.release_date ? String(m.release_date).slice(0, 10) : '—'}</div>
                  </div>
                </div>
              </td>
              <td><span className={`pill ${m.movie_access === 'free' ? 'info' : 'on'}`}>{m.movie_access === 'free' ? 'Free' : 'Paid'}</span></td>
              <td style={{ textTransform: 'capitalize' }}>{m.language ?? '—'}</td>
              <td>{m.IMDb_rating ?? '—'}</td>
              <td><span className={`pill ${m.status == 1 ? 'on' : 'off'}`}>{m.status == 1 ? 'Active' : 'Off'}</span></td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => openEdit(m.id)}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(m.id, m.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>No {title.toLowerCase()} found.</td></tr>
          )}
        </tbody>
      </table>

      {editing && (
        <div className="modal-back" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'New'} {type === 'movie' ? 'Movie' : 'TV Show'}</h2>
            <div className="tabs" style={{ marginBottom: 16 }}>
              {FORM_TABS.map((t) => (
                <button key={t.key} className={formTab === t.key ? 'active' : ''} onClick={() => setFormTab(t.key)}>{t.label}</button>
              ))}
            </div>

            {formTab === 'general' && (
              <div className="form-grid">
                <Field label="Name" span>
                  <input value={editing.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>
                <Field label="Short description" span>
                  <input value={editing.short_description ?? ''} onChange={(e) => set({ short_description: e.target.value })} />
                </Field>
                <Field label="Description" span>
                  <textarea rows={3} value={editing.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
                </Field>
                <Field label="Release date">
                  <input type="date" value={editing.release_date ? String(editing.release_date).slice(0, 10) : ''} onChange={(e) => set({ release_date: e.target.value })} />
                </Field>
                <Field label="Language">
                  <input value={editing.language ?? ''} onChange={(e) => set({ language: e.target.value })} />
                </Field>
                <Field label="Content rating">
                  <input placeholder="PG-13" value={editing.content_rating ?? ''} onChange={(e) => set({ content_rating: e.target.value })} />
                </Field>
                <Field label="IMDb rating">
                  <input value={editing.IMDb_rating ?? ''} onChange={(e) => set({ IMDb_rating: e.target.value })} />
                </Field>
                <Field label="Duration">
                  <input placeholder="02h 30m" value={editing.duration ?? ''} onChange={(e) => set({ duration: e.target.value })} />
                </Field>
                <Field label="Status">
                  <select value={editing.status ?? 1} onChange={(e) => set({ status: Number(e.target.value) })}>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </Field>
                <Field label="Age restricted">
                  <select value={editing.is_restricted ?? 0} onChange={(e) => set({ is_restricted: Number(e.target.value) })}>
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </Field>
              </div>
            )}

            {formTab === 'media' && (
              <div className="form-grid">
                <Field label="Bunny Stream Video ID" span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      placeholder="Paste Bunny video ID (guid) to embed"
                      value={editing.bunny_video_url ?? ''}
                      onChange={(e) => set({ bunny_video_url: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <BunnyUploadButton contentId={editing.id} title={editing.name} onDone={(vid) => set({ bunny_video_url: vid })} />
                  </div>
                  <small style={{ color: 'var(--muted)' }}>Set your Library ID + API Key in Settings → Bunny Stream. Uploading attaches the new video to this title.</small>
                </Field>
                <Field label="Bunny Trailer Video ID">
                  <input value={editing.bunny_trailer_url ?? ''} onChange={(e) => set({ bunny_trailer_url: e.target.value })} />
                </Field>
                <Field label="Trailer URL (YouTube)">
                  <input value={editing.trailer_url ?? ''} onChange={(e) => set({ trailer_url: e.target.value })} />
                </Field>
                <Field label="Video URL (external/HLS)">
                  <input value={editing.video_url_input ?? ''} onChange={(e) => set({ video_url_input: e.target.value })} />
                </Field>
                <Field label="Enable quality variants">
                  <select value={editing.enable_quality ?? 0} onChange={(e) => set({ enable_quality: Number(e.target.value) })}>
                    <option value={0}>Off</option>
                    <option value={1}>On</option>
                  </select>
                </Field>
                <Field label="Poster">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editing.poster_url ?? ''} onChange={(e) => set({ poster_url: e.target.value })} style={{ flex: 1 }} />
                    <UploadButton onDone={(url) => set({ poster_url: url })} />
                  </div>
                </Field>
                <Field label="Thumbnail">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editing.thumbnail_url ?? ''} onChange={(e) => set({ thumbnail_url: e.target.value })} style={{ flex: 1 }} />
                    <UploadButton onDone={(url) => set({ thumbnail_url: url })} />
                  </div>
                </Field>
                <Field label="Enable subtitles">
                  <select value={editing.enable_subtitle ?? 0} onChange={(e) => set({ enable_subtitle: Number(e.target.value) })}>
                    <option value={0}>Off</option>
                    <option value={1}>On</option>
                  </select>
                </Field>
                <Field label="Subtitle language">
                  <input placeholder="english" value={editing.subtitle_language ?? ''} onChange={(e) => set({ subtitle_language: e.target.value })} />
                </Field>
                <Field label="Subtitle file (.vtt/.srt)" span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editing.subtitle_file ?? ''} onChange={(e) => set({ subtitle_file: e.target.value })} style={{ flex: 1 }} />
                    <UploadButton accept=".vtt,.srt" onDone={(url) => set({ subtitle_file: url })} />
                  </div>
                </Field>
              </div>
            )}

            {formTab === 'pricing' && (
              <div className="form-grid">
                <Field label="Access">
                  <select value={editing.movie_access ?? 'free'} onChange={(e) => set({ movie_access: e.target.value })}>
                    <option value="free">Free</option>
                    <option value="paid">Paid (pay-per-view)</option>
                  </select>
                </Field>
                <Field label="Plan (subscription gated)">
                  <select value={editing.plan_id ?? ''} onChange={(e) => set({ plan_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">None</option>
                    {(options?.plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Price ($)">
                  <input type="number" step="0.01" value={editing.price ?? ''} onChange={(e) => set({ price: e.target.value ? Number(e.target.value) : null })} />
                </Field>
                <Field label="Discount (%)">
                  <input type="number" value={editing.discount ?? ''} onChange={(e) => set({ discount: e.target.value ? Number(e.target.value) : null })} />
                </Field>
                <Field label="Purchase type">
                  <select value={editing.purchase_type ?? 'rental'} onChange={(e) => set({ purchase_type: e.target.value })}>
                    <option value="rental">Rental</option>
                    <option value="purchase">Purchase</option>
                  </select>
                </Field>
                <Field label="Access duration (days)">
                  <input type="number" value={editing.access_duration ?? ''} onChange={(e) => set({ access_duration: e.target.value ? Number(e.target.value) : null })} />
                </Field>
                <Field label="Available for">
                  <input placeholder="e.g. 30 days" value={editing.available_for ?? ''} onChange={(e) => set({ available_for: e.target.value })} />
                </Field>
              </div>
            )}

            {formTab === 'seo' && (
              <div className="form-grid">
                <Field label="Meta title" span>
                  <input value={editing.meta_title ?? ''} onChange={(e) => set({ meta_title: e.target.value })} />
                </Field>
                <Field label="Meta keywords" span>
                  <input value={editing.meta_keywords ?? ''} onChange={(e) => set({ meta_keywords: e.target.value })} />
                </Field>
                <Field label="Meta description" span>
                  <textarea rows={3} value={editing.meta_description ?? ''} onChange={(e) => set({ meta_description: e.target.value })} />
                </Field>
                <Field label="SEO image" span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editing.seo_image ?? ''} onChange={(e) => set({ seo_image: e.target.value })} style={{ flex: 1 }} />
                    <UploadButton onDone={(url) => set({ seo_image: url })} />
                  </div>
                </Field>
              </div>
            )}

            {formTab === 'cast' && (
              <div className="form-grid">
                <Field label="Genres" span>
                  <div className="check-grid">
                    {(options?.genres ?? []).map((g) => (
                      <label key={g.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={(editing.genre_ids ?? []).includes(g.id)}
                          onChange={(e) => {
                            const cur = editing.genre_ids ?? []
                            set({ genre_ids: e.target.checked ? [...cur, g.id] : cur.filter((x) => x !== g.id) })
                          }}
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Cast (actors)" span>
                  <div className="check-grid">
                    {actors.map((c) => (
                      <label key={c.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={(editing.cast_ids ?? []).includes(c.id)}
                          onChange={(e) => {
                            const cur = editing.cast_ids ?? []
                            set({ cast_ids: e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id) })
                          }}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Directors" span>
                  <div className="check-grid">
                    {directors.map((c) => (
                      <label key={c.id} className="check-item">
                        <input
                          type="checkbox"
                          checked={(editing.director_ids ?? []).includes(c.id)}
                          onChange={(e) => {
                            const cur = editing.director_ids ?? []
                            set({ director_ids: e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id) })
                          }}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            )}

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
