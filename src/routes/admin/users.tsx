import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListUsers, adminSetUserBanned } from '../../lib/admin'

export const Route = createFileRoute('/admin/users')({
  loader: async () => await adminListUsers(),
  component: AdminUsers,
})

function AdminUsers() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function toggleBan(id: number, banned: boolean) {
    setBusyId(id)
    setError(null)
    try {
      await adminSetUserBanned({ data: { id, banned } })
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Users</span></div>
      {error && <div className="error">{error}</div>}
      <table className="admin-table">
        <thead><tr><th>User</th><th>Type</th><th>Profiles</th><th>Subscribed</th><th>Joined</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((u: any) => {
            const banned = u.is_banned == 1
            return (
              <tr key={u.id}>
                <td>
                  <div className="cell-title">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</div>
                  <div className="cell-sub">{u.email}</div>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{(u.user_type ?? 'user').replace('_', ' ')}</td>
                <td>{u.profiles}</td>
                <td><span className={`pill ${u.is_subscribe == 1 ? 'on' : 'off'}`}>{u.is_subscribe == 1 ? 'Yes' : 'No'}</span></td>
                <td>{u.created_at ? String(u.created_at).slice(0, 10) : '—'}</td>
                <td>
                  <button
                    className={`toggle ${banned ? '' : 'on'}`}
                    disabled={busyId === u.id || u.user_type === 'admin'}
                    title={u.user_type === 'admin' ? 'Admin accounts cannot be banned' : banned ? 'Unban user' : 'Ban user'}
                    onClick={() => toggleBan(u.id, !banned)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
