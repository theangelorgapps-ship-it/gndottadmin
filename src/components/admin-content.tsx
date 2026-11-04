import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { adminUpsertContent, adminDeleteContent, type ContentInput } from '../lib/admin'
import { img } from './Poster'

const EMPTY: ContentInput = {
  name: '', type: 'movie', description: '', release_date: '', language: 'english',
  movie_access: 'free', content_rating: '', IMDb_rating: '', duration: '', status: 1,
}

export function ContentAdmin({ items, type, title }: { items: any[]; type: 'movie' | 'tvshow' }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ContentInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = items.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))

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
    if (!confirm(`Delete “${name}”? This can be undone from the database.`)) return
    await adminDeleteContent({ data: id })
    router.invalidate()
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">{title}</span></div>
      <div className="toolbar">
        <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY, type })}>+ New {type === 'movie' ? 'Movie' : 'TV Show'}</button>
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
                  <button className="btn btn-dark btn-xs" onClick={() => setEditing({
                    id: m.id, name: m.name, type, description: '',
                    release_date: m.release_date ? String(m.release_date).slice(0, 10) : '',
                    language: m.language ?? 'english', movie_access: m.movie_access ?? 'free',
                    content_rating: m.content_rating ?? '', IMDb_rating: m.IMDb_rating ?? '',
                    duration: m.duration ?? '', status: m.status ?? 1,
                  })}>Edit</button>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'New'} {type === 'movie' ? 'Movie' : 'TV Show'}</h2>
            <div className="field">
              <label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Release date</label>
                <input type="date" value={editing.release_date ?? ''} onChange={(e) => setEditing({ ...editing, release_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Language</label>
                <input value={editing.language ?? ''} onChange={(e) => setEditing({ ...editing, language: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Access</label>
                <select value={editing.movie_access ?? 'free'} onChange={(e) => setEditing({ ...editing, movie_access: e.target.value })}>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="field">
                <label>IMDb rating</label>
                <input value={editing.IMDb_rating ?? ''} onChange={(e) => setEditing({ ...editing, IMDb_rating: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Duration</label>
                <input placeholder="02h 30m" value={editing.duration ?? ''} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={editing.status ?? 1} onChange={(e) => setEditing({ ...editing, status: Number(e.target.value) })}>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
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
