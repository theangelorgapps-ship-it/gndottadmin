import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { adminGetRow, adminUpsertRow, adminDeleteRow } from '../lib/admin'
import { useConfirm } from '../lib/confirm'
import { useToast } from '../lib/toast'
import { AdminDataTable, type DataCol } from './AdminDataTable'
import { img } from './Poster'
import { fieldOptions, changeField, type Field } from '../lib/crud-fields'
export type { Field } from '../lib/crud-fields'

export type CrudCol = DataCol

export function CrudTable({
  title,
  group,
  entity,
  rows,
  columns,
  fields,
  empty,
  readonly = false,
  singular,
}: {
  title: string
  group: string
  entity: string
  rows: any[]
  columns: CrudCol[]
  fields: Field[]
  empty?: string
  readonly?: boolean
  singular?: string
}) {
  const itemLabel = singular ?? title.replace(/s$/, '')
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
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
      const data = await res.json() as { error?: string; url: string }
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
      setEditing((cur: any) => (cur ? { ...cur, [fieldKey]: data.url } : cur))
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed.')
      notify({ title: 'Upload failed', description: e?.message ?? 'The file could not be uploaded.', variant: 'destructive' })
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
        if (f.required && (v == null || String(v).trim() === '')) throw new Error(`${f.label} is required.`)
        if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
        if (f.type === 'toggle') v = v ? 1 : 0
        values[f.key] = v
      }
      await adminUpsertRow({ data: { entity, id: editing.id, values } })
      setOpen(false)
      setEditing(null)
      notify({ title: `${itemLabel} saved`, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the record.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    const ok = await confirmAction({
      title: `Delete this ${itemLabel.toLowerCase()}?`,
      description: 'This record will be removed from the active list.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeleteRow({ data: { entity, id } })
      notify({ title: 'Record deleted', variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the record.', variant: 'destructive' })
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
            + Add {itemLabel}
          </button>
        )}
      </div>
      {error && !open && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      <AdminDataTable
        rows={rows}
        columns={columns}
        busy={busy}
        searchable={['name', 'title', 'label']}
        empty={empty ?? `No ${title.toLowerCase()} records.`}
        onEdit={!readonly && fields.length > 0 ? (r) => openEdit(r.id) : undefined}
        onDelete={!readonly ? (r) => remove(r.id) : undefined}
      />

      {open && editing && (
        <div className="modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit' : 'Add'} {itemLabel}</h2>
            <div className="modal-form">
              {fields.map((f) => (
                <label key={f.key} className={`mfield ${f.type === 'textarea' ? 'span2' : ''}`}>
                  <span>{f.label}{f.required ? ' *' : ''}</span>
                  {f.type === 'textarea' ? (
                    <textarea rows={3} value={editing[f.key] ?? ''} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  ) : f.type === 'select' ? (
                    <select value={editing[f.key] ?? ''} disabled={!!f.dependsOn && !editing[f.dependsOn]} onChange={(e) => setEditing(changeField(fields, editing, f.key, e.target.value))}>
                      <option value="">{f.dependsOn ? 'No group selected' : '—'}</option>
                      {fieldOptions(f, editing).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
