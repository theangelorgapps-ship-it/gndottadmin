import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListUsers, adminSetUserBanned } from '../../lib/admin'
import { useToast } from '../../lib/toast'

export const Route = createFileRoute('/admin/users')({
  loader: async () => await adminListUsers(),
  component: AdminUsers,
})

const avatarUrl = (seed: string) => `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`

function AdminUsers() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const notify = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function toggleBan(id: number, banned: boolean, name: string) {
    setBusyId(id)
    try {
      await adminSetUserBanned({ data: { id, banned } })
      notify({
        title: banned ? 'User banned' : 'User unbanned',
        description: name,
        variant: banned ? 'destructive' : 'success',
      })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Action failed', description: e?.message ?? 'Could not update the user.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Users</span></div>
      <div className="toolbar">
        <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>{items.length} records</span>
        <span className="spacer" />
      </div>
      <div className="ml-shell">
        <div className="ml-head">
          <div className="ml-grow">Name</div>
          <div className="ml-col">Type</div>
          <div className="ml-col">Profiles</div>
          <div className="ml-col">Subscribed</div>
          <div className="ml-col-lg">Joined</div>
          <div className="ml-col">Status</div>
        </div>
        {items.length === 0 && <div className="empty">No users.</div>}
        {items.map((u: any) => {
          const banned = u.is_banned == 1
          const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—'
          return (
            <div className="ml-row" key={u.id}>
              <div className="ml-grow">
                <div className="ml-avatar">
                  <img src={avatarUrl(u.email ?? String(u.id))} alt={name} loading="lazy" />
                  <span
                    className="ml-dot"
                    title={banned ? 'banned' : 'active'}
                    style={{ background: banned ? '#f44336' : u.is_subscribe == 1 ? '#00cc66' : '#969696' }}
                  />
                </div>
                <div className="ml-id">
                  <Link to={`/admin/user/${u.id}` as any} className="ml-name">{name}</Link>
                  <span className="ml-sub">{u.email}</span>
                </div>
              </div>
              <div className="ml-col" style={{ textTransform: 'capitalize' }}>{(u.user_type ?? 'user').replace('_', ' ')}</div>
              <div className="ml-col">{u.profiles}</div>
              <div className="ml-col">
                <span className={`pill ${u.is_subscribe == 1 ? 'on' : 'off'}`}>{u.is_subscribe == 1 ? 'Yes' : 'No'}</span>
              </div>
              <div className="ml-col-lg">{u.created_at ? String(u.created_at).slice(0, 10) : '—'}</div>
              <div className="ml-col">
                <button
                  className={`toggle ${banned ? '' : 'on'}`}
                  disabled={busyId === u.id || u.user_type === 'admin'}
                  title={u.user_type === 'admin' ? 'Admin accounts cannot be banned' : banned ? 'Unban user' : 'Ban user'}
                  onClick={() => toggleBan(u.id, !banned, name)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
