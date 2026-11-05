import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  adminTable, adminGetRole, adminUpsertRole, adminDeleteRole, adminListPermissions,
} from '../../lib/admin'

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

  const toggle = (pid: number) =>
    setForm((f) => ({
      ...f,
      permission_ids: f.permission_ids.includes(pid)
        ? f.permission_ids.filter((x) => x !== pid)
        : [...f.permission_ids, pid],
    }))

  return (
    <div className="modal-back" onClick={() => onClose(false)}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{form.id ? `Edit Role — ${form.title || form.name}` : 'New Role'}</h2>
        <div className="form-grid">
          <div className="field">
            <label>Name (identifier)</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Title (display)</label>
            <input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <label style={{ fontWeight: 600, fontSize: 13.5, display: 'block', margin: '14px 0 8px' }}>
          Permissions ({form.permission_ids.length} selected)
        </label>
        <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
          {groups.map(([g, ps]) => (
            <div key={g} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <strong style={{ textTransform: 'capitalize', fontSize: 13 }}>{g}</strong>
                <button
                  className="btn btn-dark btn-xs"
                  onClick={() => {
                    const ids = ps.map((p) => p.id)
                    const allOn = ids.every((id) => form.permission_ids.includes(id))
                    setForm((f) => ({
                      ...f,
                      permission_ids: allOn
                        ? f.permission_ids.filter((x) => !ids.includes(x))
                        : [...new Set([...f.permission_ids, ...ids])],
                    }))
                  }}
                >
                  toggle all
                </button>
              </div>
              <div className="check-grid">
                {ps.map((p) => (
                  <label key={p.id} className="check-item">
                    <input type="checkbox" checked={form.permission_ids.includes(p.id)} onChange={() => toggle(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-dark" onClick={() => onClose(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || !form.name.trim()}
            onClick={async () => {
              setBusy(true); setError(null)
              try {
                await adminUpsertRole({ data: form })
                onClose(true)
              } catch (e: any) {
                setError(e?.message ?? 'Save failed.')
              } finally {
                setBusy(false)
              }
            }}
          >{busy ? 'Saving…' : 'Save Role'}</button>
        </div>
      </div>
    </div>
  )
}

function Page() {
  const { roles, permissions } = Route.useLoaderData() as any
  const router = useRouter()
  const [editing, setEditing] = useState<any>(null)

  async function openEdit(id: number) {
    try {
      const role: any = await adminGetRole({ data: id })
      setEditing(role)
    } catch (e: any) {
      alert(e?.message ?? 'Could not load role.')
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Access Control</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', title: '', permission_ids: [] })}>+ New Role</button>
      </div>
      <table className="admin-table">
        <thead>
          <tr><th>Role</th><th>Name</th><th>Users</th><th>Permissions</th><th style={{ width: 150 }}></th></tr>
        </thead>
        <tbody>
          {roles.map((r: any) => (
            <tr key={r.id}>
              <td><span className="cell-title">{r.title ?? r.name}</span></td>
              <td>{r.name}</td>
              <td>{r.users}</td>
              <td>{r.permissions}</td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => openEdit(r.id)}>Edit</button>
                  {!r.is_fixed && (
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        if (!confirm(`Delete role "${r.name}"?`)) return
                        try {
                          await adminDeleteRole({ data: r.id })
                          router.invalidate()
                        } catch (e: any) {
                          alert(e?.message ?? 'Delete failed.')
                        }
                      }}
                    >Delete</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <RoleEditor
          role={editing}
          permissions={permissions}
          onClose={(saved) => { setEditing(null); if (saved) router.invalidate() }}
        />
      )}
    </div>
  )
}
