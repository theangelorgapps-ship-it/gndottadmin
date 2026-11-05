import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { adminGetRow, adminUpsertRow, adminDeleteRow } from '../lib/admin'
import { img } from './Poster'

export type Field = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'image' | 'date'
  options?: { value: string | number; label: string }[]
  required?: boolean
  placeholder?: string
}

export type CrudCol = { key: string; label: string; kind?: 'text' | 'img' | 'pill' | 'money' | 'date' | 'stars' }

export function CrudTable({
  title,
  group,
  entity,
  rows,
  columns,
  fields,
  empty,
  readonly = false,
}: {
  title: string
  group: string
  entity: string
  rows: any[]
  columns: CrudCol[]
  fields: Field[]
  empty?: string
  readonly?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  async function uploadFile(fieldKey: string, file?: File | null) {
    if (!file) return
    setUploading(fieldKey)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
      setEditing((cur: any) => (cur ? { ...cur, [fieldKey]: data.url } : cur))
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed.')
    } finally {
      setUploading(null)
    }
  }

  async function openEdit(id: number) {
    setBusy(true)
    setError(null)
    try {
      const row = await adminGetRow({ data: { entity, id } })
      setEditing(row)
      setOpen(true)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load record.')
    } finally {
      setBusy(false)
    }
  }

  function openAdd() {
    const blank: Record<string, any> = {}
    for (const f of fields) blank[f.key] = f.type === 'toggle' ? 1 : ''
    setEditing(blank)
    setOpen(true)
  }

  async function save() {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      const values: Record<string, any> = {}
      for (const f of fields) {
        let v = editing[f.key]
        if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
        if (f.type === 'toggle') v = v ? 1 : 0
        values[f.key] = v
      }
      await adminUpsertRow({ data: { entity, id: editing.id, values } })
      setOpen(false)
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this record?')) return
    setBusy(true)
    try {
      await adminDeleteRow({ data: { entity, id } })
      router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="breadcrumb">{group} <span className="sep">/</span> <span className="here">{title}</span></div>
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>{rows.length} records</span>
        <span className="spacer" />
        {!readonly && fields.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={openAdd} disabled={busy}>
            + Add {title.replace(/s$/, '')}
          </button>
        )}
      </div>
      {error && !open && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {rows.length === 0 ? (
        <div className="empty">{empty ?? `No ${title.toLowerCase()} records.`}</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key}>{c.label}</th>)}
              {!readonly && <th style={{ width: 120 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.id ?? i}>
                {columns.map((c) => <td key={c.key}>{renderCell(r, c)}</td>)}
                {!readonly && (
                  <td className="row-actions">
                    {fields.length > 0 && <button className="btn btn-dark btn-sm" onClick={() => openEdit(r.id)} disabled={busy}>Edit</button>}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)} disabled={busy}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && editing && (
        <div className="modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</h2>
            <div className="modal-form">
              {fields.map((f) => (
                <label key={f.key} className={`mfield ${f.type === 'textarea' ? 'span2' : ''}`}>
                  <span>{f.label}{f.required ? ' *' : ''}</span>
                  {f.type === 'textarea' ? (
                    <textarea rows={3} value={editing[f.key] ?? ''} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  ) : f.type === 'select' ? (
                    <select value={editing[f.key] ?? ''} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}>
                      <option value="">—</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'toggle' ? (
                    <select value={editing[f.key] ? 1 : 0} onChange={(e) => setEditing({ ...editing, [f.key]: Number(e.target.value) })}>
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  ) : f.type === 'image' ? (
                    <span className="img-field">
                      <input type="text" placeholder="image filename or URL" value={editing[f.key] ?? ''} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                      <label className="btn btn-dark btn-sm upload-btn">
                        {uploading === f.key ? 'Uploading…' : 'Upload'}
                        <input type="file" accept="image/*" hidden disabled={busy || uploading === f.key} onChange={(e) => uploadFile(f.key, e.target.files?.[0])} />
                      </label>
                      {editing[f.key] ? <img src={img(editing[f.key])} alt="" className="img-preview" /> : null}
                    </span>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      step={f.type === 'number' ? 'any' : undefined}
                      placeholder={f.placeholder}
                      value={editing[f.key] ?? ''}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
            {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-dark" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function renderCell(r: any, c: CrudCol) {
  const v = r[c.key]
  switch (c.kind) {
    case 'img':
      return (
        <div className="cell-main">
          <img src={img(v)} alt="" />
          <span className="cell-title">{r[c.key.replace('file_url', 'name').replace('poster_url', 'name')] ?? r.name ?? ''}</span>
        </div>
      )
    case 'pill':
      return <span className={`pill ${v == 1 ? 'on' : 'off'}`}>{v == 1 ? 'Active' : 'Off'}</span>
    case 'money':
      return <>${Number(v ?? 0).toFixed(2)}</>
    case 'date':
      return <>{v ? String(v).slice(0, 10) : '—'}</>
    case 'stars':
      return <>{'★'.repeat(Math.round(Number(v) || 0))}{'☆'.repeat(5 - Math.round(Number(v) || 0))}</>
    default:
      return <>{v ?? '—'}</>
  }
}
