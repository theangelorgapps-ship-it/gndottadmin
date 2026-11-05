import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListVideos, adminUpsertVideo, adminDeleteVideo, adminGetVideo } from '../../lib/admin'

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

function BunnyUploadButton({ videoId, title, onDone }: { videoId?: number; title: string; onDone: (vid: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <label className="btn btn-dark btn-xs" style={{ cursor: 'pointer' }}>
      {busy ? 'Uploading to Bunny…' : 'Upload to Bunny Stream'}
      <input
        type="file" accept="video/*" style={{ display: 'none' }} disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          setBusy(true)
          const fd = new FormData()
          fd.append('file', f)
          fd.append('title', title || f.name)
          if (videoId) { fd.append('table', 'videos'); fd.append('row_id', String(videoId)) }
          const res = await fetch('/api/bunny-upload', { method: 'POST', body: fd })
          const json: any = await res.json().catch(() => null)
          setBusy(false)
          if (json?.ok) onDone(json.videoId)
          else alert(json?.error ?? 'Bunny upload failed')
          e.target.value = ''
        }}
      />
    </label>
  )
}

function AdminVideos() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState<VForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openEdit(id: number) {
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
      alert(e?.message ?? 'Could not load record.')
    }
  }

  async function save() {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      await adminUpsertVideo({ data: editing })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await adminDeleteVideo({ data: id })
    router.invalidate()
  }

  const set = (patch: Partial<VForm>) => setEditing((cur) => (cur ? { ...cur, ...patch } : cur))

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Videos</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ New Video</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Duration</th><th>Release</th><th>Rating</th><th>Status</th><th style={{ width: 150 }}></th></tr></thead>
        <tbody>
          {items.map((v: any) => (
            <tr key={v.id}>
              <td><span className="cell-title">{v.name}</span></td>
              <td>{v.duration ?? '—'}</td>
              <td>{v.release_date ? String(v.release_date).slice(0, 10) : '—'}</td>
              <td>{v.IMDb_rating ?? '—'}</td>
              <td><span className={`pill ${v.status == 1 ? 'on' : 'off'}`}>{v.status == 1 ? 'Active' : 'Off'}</span></td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => openEdit(v.id)}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(v.id, v.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <div className="modal-back" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'New'} Video</h2>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Name</label>
                <input value={editing.name} onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label>
                <textarea rows={3} value={editing.description} onChange={(e) => set({ description: e.target.value })} /></div>
              <div className="field"><label>Duration</label>
                <input value={editing.duration} onChange={(e) => set({ duration: e.target.value })} /></div>
              <div className="field"><label>Release date</label>
                <input type="date" value={editing.release_date} onChange={(e) => set({ release_date: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Bunny Stream Video ID</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input placeholder="Paste Bunny video ID (guid) to embed" value={editing.bunny_video_url ?? ''} onChange={(e) => set({ bunny_video_url: e.target.value })} style={{ flex: 1 }} />
                  <BunnyUploadButton videoId={editing.id} title={editing.name} onDone={(vid) => set({ bunny_video_url: vid })} />
                </div>
              </div>
              <div className="field"><label>Trailer URL (YouTube)</label>
                <input value={editing.trailer_url ?? ''} onChange={(e) => set({ trailer_url: e.target.value })} /></div>
              <div className="field"><label>External video URL</label>
                <input value={editing.video_url_input ?? ''} onChange={(e) => set({ video_url_input: e.target.value })} /></div>
              <div className="field"><label>Access</label>
                <select value={editing.access ?? 'free'} onChange={(e) => set({ access: e.target.value })}>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select></div>
              <div className="field"><label>Price ($)</label>
                <input type="number" step="0.01" value={editing.price ?? ''} onChange={(e) => set({ price: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="field"><label>Subtitles</label>
                <select value={editing.enable_subtitle ?? 0} onChange={(e) => set({ enable_subtitle: Number(e.target.value) })}>
                  <option value={0}>Off</option>
                  <option value={1}>On</option>
                </select></div>
              <div className="field"><label>Subtitle language</label>
                <input value={editing.subtitle_language ?? ''} onChange={(e) => set({ subtitle_language: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Subtitle file</label>
                <input value={editing.subtitle_file ?? ''} onChange={(e) => set({ subtitle_file: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Meta title (SEO)</label>
                <input value={editing.meta_title ?? ''} onChange={(e) => set({ meta_title: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Meta keywords (SEO)</label>
                <input value={editing.meta_keywords ?? ''} onChange={(e) => set({ meta_keywords: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Meta description (SEO)</label>
                <textarea rows={2} value={editing.meta_description ?? ''} onChange={(e) => set({ meta_description: e.target.value })} /></div>
            </div>
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
