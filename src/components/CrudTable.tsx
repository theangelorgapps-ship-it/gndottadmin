import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { adminGetRow, adminUpsertRow, adminDeleteRow } from '../lib/admin'
import { useConfirm } from '../lib/confirm'
import { useToast } from '../lib/toast'
import { AdminDataTable, type DataCol } from './AdminDataTable'
import { AdminImagePreview } from './Poster'
import { UploadDialog } from './UploadDialog'
import { RichTextEditor } from './RichTextEditor'
import { richTextHasContent } from '../lib/rich-text'
import { fieldOptions, changeField, type Field } from '../lib/crud-fields'
export type { Field } from '../lib/crud-fields'

export type CrudCol = DataCol

export function orderPersonalities<T extends { name?: string; designation?: string }>(people: T[]): T[] {
  function rank(person: T) {
    const normalized = `${person.name ?? ''} ${person.designation ?? ''}`.normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g, '')
    if (/\braah\b/.test(normalized) || /\buebert angel\b/.test(normalized)) return 0
    if (/\bneviah\b/.test(normalized) || /\bbebe angel\b/.test(normalized)) return 1
    return 2
  }
  return [...people].sort((left, right) => rank(left) - rank(right) || String(left.name ?? '').localeCompare(String(right.name ?? '')))
}

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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitleId = useId()
  const dialogHelpId = useId()
  const formId = useId()
  const isBusy = busy || uploading !== null

  useEffect(() => {
    if (!open) return
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
  }, [open])

  async function openEdit(id: number) {
    setBusy(true)
    setError(null)
    try {
      const row = await adminGetRow({ data: { entity, id } })
      const values = { ...(row as Record<string, any>) }
      for (const field of fields) {
        if (field.type === 'date' && values[field.key]) values[field.key] = String(values[field.key]).slice(0, 10)
      }
      setEditing(values)
      setOpen(true)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load record.')
      notify({ title: 'Could not load record', description: e?.message ?? 'Please try again.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function openAdd() {
    const blank: Record<string, any> = {}
    for (const field of fields) blank[field.key] = field.type === 'toggle' ? 1 : field.key === 'access' ? 'free' : ''
    setError(null)
    setEditing(blank)
    setOpen(true)
  }

  function requestClose() {
    if (isBusy) return
    setOpen(false)
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing || isBusy) return
    setBusy(true)
    setError(null)
    try {
      const values: Record<string, any> = {}
      for (const field of fields) {
        let value = editing[field.key]
        if (field.required && (field.type === 'richtext' ? !richTextHasContent(value) : value == null || String(value).trim() === '')) throw new Error(`${field.label} is required.`)
        if (field.type === 'number') {
          value = value === '' || value == null ? null : Number(value)
          if (value !== null && !Number.isFinite(value)) throw new Error(`${field.label} must be a number.`)
        }
        if (field.type === 'select' && value != null && value !== '' && !fieldOptions(field, editing).some(option => String(option.value) === String(value))) throw new Error(`Choose a valid ${field.label.toLowerCase()}.`)
        if (field.type === 'toggle') value = value ? 1 : 0
        values[field.key] = value
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
    <div className="min-w-0">
      <div className="breadcrumb">{group} <span className="sep">/</span> <span className="here">{title}</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
        <span className="spacer" />
        {!readonly && fields.length > 0 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd} disabled={busy}>
            + Add {itemLabel}
          </button>
        )}
      </div>
      {error && !open && <div className="error mb-3" role="alert">{error}</div>}
      <AdminDataTable
        rows={entity === 'actors' ? orderPersonalities(rows) : rows}
        columns={columns}
        busy={busy}
        searchable={['name', 'title', 'label']}
        searchPlaceholder={`Search ${title.toLowerCase()}…`}
        empty={empty ?? `No ${title.toLowerCase()} records.`}
        onEdit={!readonly && fields.length > 0 ? (row) => openEdit(row.id) : undefined}
        onDelete={!readonly ? (row) => remove(row.id) : undefined}
      />

      {open && editing && (
        <dialog
          ref={dialogRef}
          className="modal modal-wide m-auto max-h-[calc(100dvh-2rem)] w-[min(45rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-5 sm:p-6 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogHelpId}
          aria-busy={isBusy}
          onCancel={(event) => {
            // Native dialog cancel covers Escape; never dismiss an active save/upload.
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
            <div className="mb-5">
              <h2 id={dialogTitleId} className="mb-1">{editing.id ? 'Edit' : 'Add'} {itemLabel}</h2>
              <p id={dialogHelpId} className="text-sm text-muted-foreground">Fields marked * are required. Your changes are not saved until you select Save.</p>
            </div>
            <div className="modal-form">
              {fields.map((field, index) => {
                const inputId = `${formId}-${field.key}`
                const dependentDisabled = Boolean(field.dependsOn && !editing[field.dependsOn])
                const parentLabel = fields.find((candidate) => candidate.key === field.dependsOn)?.label ?? 'parent'
                const options = fieldOptions(field, editing)
                return (
                  <div key={field.key} className={`mfield ${field.type === 'textarea' || field.type === 'richtext' || field.type === 'image' ? 'span2' : ''}`}>
                    <label htmlFor={inputId}>
                      {field.label}{field.required ? <span aria-hidden="true"> *</span> : null}
                    </label>
                    {field.type === 'richtext' ? (
                      <RichTextEditor id={inputId} label={field.label} value={editing[field.key] ?? ''} disabled={busy} required={field.required} initialFocus={index === 0} onChange={html => setEditing(current => current ? { ...current, [field.key]: html } : current)} />
                    ) : field.type === 'textarea' ? (
                      <textarea
                        id={inputId}
                        rows={3}
                        value={editing[field.key] ?? ''}
                        disabled={busy}
                        aria-required={field.required || undefined}
                        data-initial-focus={index === 0 ? true : undefined}
                        onChange={(event) => setEditing({ ...editing, [field.key]: event.target.value })}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={inputId}
                        value={editing[field.key] ?? ''}
                        disabled={busy || dependentDisabled}
                        aria-required={field.required || undefined}
                        data-initial-focus={index === 0 ? true : undefined}
                        onChange={(event) => setEditing(changeField(fields, editing, field.key, event.target.value))}
                      >
                        <option value="">{dependentDisabled ? `Select ${parentLabel} first` : '— Select —'}</option>
                        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : field.type === 'toggle' ? (
                      <select
                        id={inputId}
                        value={editing[field.key] ? 1 : 0}
                        disabled={busy}
                        data-initial-focus={index === 0 ? true : undefined}
                        onChange={(event) => setEditing({ ...editing, [field.key]: Number(event.target.value) })}
                      >
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                      </select>
                    ) : field.type === 'image' ? (
                      <span className="img-field-col">
                        <span className="img-field">
                          <input
                            id={inputId}
                            type="text"
                            placeholder="Image filename or URL"
                            value={editing[field.key] ?? ''}
                            disabled={busy}
                            aria-required={field.required || undefined}
                            data-initial-focus={index === 0 ? true : undefined}
                            onChange={(event) => setEditing({ ...editing, [field.key]: event.target.value })}
                          />
                          <button
                            type="button"
                            className="btn btn-dark btn-sm upload-btn"
                            disabled={isBusy}
                            aria-busy={uploading === field.key}
                            onClick={() => setUploading(field.key)}
                          >
                            {uploading === field.key ? 'Choosing…' : 'Choose image'}
                          </button>

                        </span>
                        <AdminImagePreview url={editing[field.key]} label={`${field.label} preview`} className="img-preview-lg" />
                      </span>
                    ) : (
                      <input
                        id={inputId}
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        step={field.type === 'number' ? 'any' : undefined}
                        placeholder={field.placeholder}
                        value={editing[field.key] ?? ''}
                        disabled={busy}
                        aria-required={field.required || undefined}
                        data-initial-focus={index === 0 ? true : undefined}
                        onChange={(event) => setEditing({ ...editing, [field.key]: event.target.value })}
                      />
                    )}
                    {field.dependsOn && (
                      <small className="text-xs font-normal text-muted-foreground">
                        {dependentDisabled ? `Choose ${parentLabel} to see matching options.` : `${options.length} matching ${options.length === 1 ? 'option' : 'options'}.`}
                      </small>
                    )}
                  </div>
                )
              })}
            </div>
            {error && <div className="error mt-3" role="alert">{error}</div>}
            <div className="modal-actions border-t border-border pt-4">
              <button type="button" className="btn btn-dark" onClick={requestClose} disabled={isBusy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isBusy} aria-disabled={isBusy}>
                {busy ? 'Saving…' : uploading ? 'Waiting for upload…' : 'Save'}
              </button>
            </div>
          </form>
          <UploadDialog open={uploading !== null} currentValue={uploading ? editing[uploading] : null} title={`Choose ${fields.find(field => field.key === uploading)?.label ?? 'image'}`} accept="image/*" onClose={() => setUploading(null)} onUploaded={(url) => { if (uploading) setEditing(current => current ? { ...current, [uploading]: url } : current); setUploading(null) }} />
        </dialog>
      )}
    </div>
  )
}
