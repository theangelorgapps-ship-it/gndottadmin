import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import {
  adminTable, adminGetRole, adminUpsertRole, adminDeleteRole, adminListPermissions,
} from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'

export const Route = createFileRoute('/admin/access-control')({
  loader: async () => {
    const [roles, permissions] = await Promise.all([
      adminTable({ data: 'access-control' }),
      adminListPermissions(),
    ])
    return { roles, permissions }
  },
  component: Page,
})

function groupPerms(perms: any[]) {
  const groups: Record<string, any[]> = {}
  for (const p of perms) {
    const g = String(p.name).split(/[_-]/)[0] || 'general'
    ;(groups[g] ??= []).push(p)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function formatPermissionName(value: unknown) {
  let label = String(value ?? '').replace(/[_-]+/g, ' ')
  const replacements: [RegExp, string][] = [
    [/\bmovies\b/gi, 'Sermons'],
    [/\bmovie\b/gi, 'Sermon'],
    [/\btv[\s-]*shows?\b/gi, 'Shows'],
    [/\btvshow\b/gi, 'Show'],
    [/\bdirectors?\b/gi, 'Locations'],
    [/\bactors?\b/gi, 'Personalities'],
    [/\breviews?\b/gi, 'Content feedback'],
    [/\bratings?\b/gi, 'Content feedback'],
    [/\bimdb\b/gi, 'External metadata'],
    [/\bstreamit\b/gi, 'GoodNews Halobox'],
  ]
  for (const [pattern, replacement] of replacements) label = label.replace(pattern, replacement)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function RoleEditor({
  role, permissions, onClose,
}: {
  role: { id?: number; name: string; title: string; permission_ids: number[] }
  permissions: any[]
  onClose: (saved: boolean) => void
}) {
  const [form, setForm] = useState(role)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groups = groupPerms(permissions)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const helpId = useId()
  const nameId = useId()
  const displayTitleId = useId()

  useEffect(() => {
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
  }, [])

  const toggle = (pid: number) =>
    setForm((current) => ({
      ...current,
      permission_ids: current.permission_ids.includes(pid)
        ? current.permission_ids.filter((id) => id !== pid)
        : [...current.permission_ids, pid],
    }))

  function requestClose() {
    if (!busy) onClose(false)
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Role name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminUpsertRole({ data: form })
      onClose(true)
    } catch (e: any) {
      setError(e?.message ?? 'The role could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-wide m-auto max-h-[calc(100dvh-2rem)] w-[min(45rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-5 sm:p-6 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={helpId}
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
      <form
        className="min-w-0"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="mb-5">
          <h2 id={titleId} className="mb-1">{form.id ? `Edit Role — ${form.title || form.name}` : 'New Role'}</h2>
          <p id={helpId} className="m-0 text-sm text-muted-foreground">Set the role identity and choose the permissions its users receive.</p>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor={nameId}>Name (identifier) <span aria-hidden="true">*</span></label>
            <input
              id={nameId}
              data-initial-focus
              value={form.name}
              disabled={busy}
              required
              aria-required="true"
              autoComplete="off"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <small className="text-xs font-normal text-muted-foreground">Spaces are converted to underscores when saved.</small>
          </div>
          <div className="field">
            <label htmlFor={displayTitleId}>Title (display)</label>
            <input
              id={displayTitleId}
              value={form.title ?? ''}
              disabled={busy}
              autoComplete="off"
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <small className="text-xs font-normal text-muted-foreground">Optional friendly name shown in this workspace.</small>
          </div>
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-foreground">Permissions ({form.permission_ids.length} selected)</legend>
          <p className="mb-3 mt-0 text-xs text-muted-foreground">Select individual permissions or update a whole group.</p>
          <div className="max-h-[22rem] min-w-0 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-3">
            {groups.length === 0 ? (
              <p className="m-0 py-6 text-center text-sm text-muted-foreground">No permissions are available. Save the role identity now and add permissions later.</p>
            ) : groups.map(([group, items]) => {
              const ids = items.map((permission) => permission.id)
              const allSelected = ids.every((id) => form.permission_ids.includes(id))
              return (
                <section key={group} className="border-b border-border py-3 last:border-0" aria-labelledby={`permission-group-${group}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`permission-group-${group}`} className="m-0 text-sm font-semibold">{formatPermissionName(group)}</h3>
                    <button
                      type="button"
                      className="btn btn-dark btn-xs"
                      aria-label={`${allSelected ? 'Clear' : 'Select'} all ${formatPermissionName(group)} permissions`}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          permission_ids: allSelected
                            ? current.permission_ids.filter((id) => !ids.includes(id))
                            : [...new Set([...current.permission_ids, ...ids])],
                        }))
                      }}
                    >
                      {allSelected ? 'Clear group' : 'Select group'}
                    </button>
                  </div>
                  <div className="check-grid max-h-none border-0 p-0">
                    {items.map((permission) => (
                      <label key={permission.id} className="check-item rounded-md px-2 py-2 hover:bg-secondary">
                        <input
                          type="checkbox"
                          checked={form.permission_ids.includes(permission.id)}
                          onChange={() => toggle(permission.id)}
                        />
                        <span className="break-words">{formatPermissionName(permission.name)}</span>
                      </label>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </fieldset>

        {error && <div className="error" role="alert">{error}</div>}
        <div className="modal-actions border-t border-border pt-4">
          <button type="button" className="btn btn-dark" onClick={requestClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !form.name.trim()} aria-busy={busy}>
            {busy ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function Page() {
  const { roles, permissions } = Route.useLoaderData() as any
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<any>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pageBusy = loadingId !== null || deletingId !== null

  async function openEdit(id: number) {
    setLoadingId(id)
    setError(null)
    try {
      const role: any = await adminGetRole({ data: id })
      setEditing(role)
    } catch (e: any) {
      const message = e?.message ?? 'Please try again.'
      setError(message)
      notify({ title: 'Could not load role', description: message, variant: 'destructive' })
    } finally {
      setLoadingId(null)
    }
  }

  async function removeRole(role: any) {
    const ok = await confirmAction({
      title: `Delete role "${role.name}"?`,
      description: 'Users assigned this role will lose its permissions.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    setDeletingId(role.id)
    setError(null)
    try {
      await adminDeleteRole({ data: role.id })
      notify({ title: 'Role deleted', description: role.name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      const message = e?.message ?? 'Could not delete the role.'
      setError(message)
      notify({ title: 'Delete failed', description: message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Access Control</span></div>
      <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0">Access Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage admin roles and the permissions assigned to each team.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pageBusy}
          onClick={() => {
            setError(null)
            setEditing({ name: '', title: '', permission_ids: [] })
          }}
        >+ New Role</button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {roles.length === 0 ? (
        <div className="panel empty overflow-visible">
          <p className="font-medium text-foreground">No roles configured</p>
          <p className="mt-1 text-sm">Create a role to begin assigning admin permissions.</p>
        </div>
      ) : (
        <section className="panel overflow-visible" aria-labelledby="roles-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="roles-heading" className="m-0 text-base font-semibold">Admin Roles</h2>
              <p className="mt-1 text-xs text-muted-foreground">Fixed system roles can be edited but not deleted.</p>
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">{roles.length} {roles.length === 1 ? 'role' : 'roles'}</span>
          </div>

          <div className="table-scroll roles-table-desktop" role="region" aria-label="Scrollable admin roles table" tabIndex={0}>
            <table className="admin-table">
              <thead><tr><th scope="col">Role</th><th scope="col">Identifier</th><th scope="col">Users</th><th scope="col">Permissions</th><th scope="col">Type</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {roles.map((role: any) => (
                  <tr key={role.id}>
                    <td><span className="cell-title">{role.title ?? role.name}</span></td>
                    <td><span className="break-words font-mono text-xs">{role.name}</span></td>
                    <td className="tabular-nums">{role.users}</td>
                    <td className="tabular-nums">{role.permissions}</td>
                    <td><span className={`pill ${role.is_fixed ? 'info' : 'off'}`}>{role.is_fixed ? 'System' : 'Custom'}</span></td>
                    <td>
                      <div className="row-actions justify-end">
                        <button
                          type="button"
                          className="btn btn-dark btn-xs"
                          disabled={pageBusy}
                          aria-busy={loadingId === role.id}
                          aria-label={`Edit role ${role.title ?? role.name}`}
                          onClick={() => void openEdit(role.id)}
                        >{loadingId === role.id ? 'Loading…' : 'Edit'}</button>
                        {!role.is_fixed && (
                          <button
                            type="button"
                            className="btn-danger"
                            disabled={pageBusy}
                            aria-busy={deletingId === role.id}
                            aria-label={`Delete role ${role.title ?? role.name}`}
                            onClick={() => void removeRole(role)}
                          >{deletingId === role.id ? 'Deleting…' : 'Delete'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:hidden" aria-label="Admin roles">
            {roles.map((role: any) => (
              <li key={role.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 break-words font-medium text-foreground">{role.title ?? role.name}</p>
                    <p className="cell-sub break-all font-mono">{role.name}</p>
                  </div>
                  <span className={`pill shrink-0 ${role.is_fixed ? 'info' : 'off'}`}>{role.is_fixed ? 'System' : 'Custom'}</span>
                </div>
                <dl className="mb-4 mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-muted-foreground">Assigned users</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{role.users}</dd></div>
                  <div><dt className="text-muted-foreground">Permissions</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{role.permissions}</dd></div>
                </dl>
                <div className="row-actions border-t border-border pt-3">
                  <button
                    type="button"
                    className="btn btn-dark"
                    disabled={pageBusy}
                    aria-busy={loadingId === role.id}
                    onClick={() => void openEdit(role.id)}
                  >{loadingId === role.id ? 'Loading…' : 'Edit Role'}</button>
                  {!role.is_fixed && (
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={pageBusy}
                      aria-busy={deletingId === role.id}
                      onClick={() => void removeRole(role)}
                    >{deletingId === role.id ? 'Deleting…' : 'Delete Role'}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <RoleEditor
          role={editing}
          permissions={permissions}
          onClose={(saved) => {
            setEditing(null)
            if (saved) {
              notify({ title: 'Role saved', variant: 'success' })
              router.invalidate()
            }
          }}
        />
      )}
    </div>
  )
}
