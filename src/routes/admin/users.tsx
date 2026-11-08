import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { adminListUsers, adminSetUserBanned } from '../../lib/admin'
import { useToast } from '../../lib/toast'

export const Route = createFileRoute('/admin/users')({
  loader: async () => await adminListUsers(),
  component: AdminUsers,
})

type UserRow = {
  id: number
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  user_type?: string | null
  profiles?: number
  is_subscribe?: number
  is_banned?: number
  created_at?: string | null
}

function userName(user: UserRow) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || `User #${user.id}`
}

function AccessToggle({
  user,
  name,
  banned,
  busy,
  blocked,
  onToggle,
}: {
  user: UserRow
  name: string
  banned: boolean
  busy: boolean
  blocked: boolean
  onToggle: () => void
}) {
  const isAdmin = user.user_type === 'admin'
  const reason = isAdmin ? 'Admin accounts cannot be banned' : banned ? `Unban ${name}` : `Ban ${name}`
  return (
    <button
      type="button"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
      role="switch"
      aria-checked={!banned}
      aria-label={`Account access for ${name}`}
      aria-busy={busy}
      disabled={busy || blocked || isAdmin}
      title={reason}
      onClick={onToggle}
    >
      <span className={`toggle ${banned ? '' : 'on'}`} aria-hidden="true" />
    </button>
  )
}

function SubscriptionPill({ subscribed }: { subscribed: boolean }) {
  return <span className={`pill ${subscribed ? 'on' : 'off'}`}>{subscribed ? 'Subscribed' : 'Not subscribed'}</span>
}

function AdminUsers() {
  const items = Route.useLoaderData() as UserRow[]
  const router = useRouter()
  const notify = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((user) => {
      const matchesQuery = !normalized || [userName(user), user.email, user.user_type]
        .some((value) => String(value ?? '').toLowerCase().includes(normalized))
      const matchesStatus = status === 'all'
        || (status === 'subscribed' && user.is_subscribe == 1)
        || (status === 'unsubscribed' && user.is_subscribe != 1)
        || (status === 'banned' && user.is_banned == 1)
        || (status === 'active' && user.is_banned != 1)
      return matchesQuery && matchesStatus
    })
  }, [items, query, status])

  async function toggleBan(id: number, banned: boolean, name: string) {
    setBusyId(id)
    setError(null)
    try {
      await adminSetUserBanned({ data: { id, banned } })
      notify({
        title: banned ? 'User banned' : 'User unbanned',
        description: name,
        variant: banned ? 'destructive' : 'success',
      })
      router.invalidate()
    } catch (e: any) {
      const message = e?.message ?? 'Could not update the user.'
      setError(message)
      notify({ title: 'Action failed', description: message, variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  function clearFilters() {
    setQuery('')
    setStatus('all')
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Users</span></div>
      <div className="mb-5">
        <h1 className="m-0">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage account access, subscriptions, and user profiles.</p>
      </div>

      <div className="toolbar" aria-label="User filters">
        <div className="min-w-0 flex-1">
          <label htmlFor="user-search" className="sr-only">Search users</label>
          <input
            id="user-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or account type…"
            className="min-h-11 w-full max-w-md md:min-h-10"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="user-status" className="sr-only">Filter users by status</label>
          <select id="user-status" className="min-h-11 md:min-h-10" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All account states</option>
            <option value="active">Active access</option>
            <option value="banned">Banned</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Not subscribed</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {filtered.length} of {items.length} {items.length === 1 ? 'user' : 'users'}
        </span>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {filtered.length === 0 ? (
        <div className="panel empty overflow-visible">
          <p className="font-medium text-foreground">{items.length === 0 ? 'No users yet' : 'No matching users'}</p>
          <p className="mt-1 text-sm">
            {items.length === 0 ? 'Registered accounts will appear here.' : 'Try a different search or account state.'}
          </p>
          {(query || status !== 'all') && <button type="button" className="btn btn-dark mt-4" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <>
          <div className="table-scroll hidden md:block" role="region" aria-label="Scrollable users table" tabIndex={0}>
            <table className="admin-table min-w-[58rem]">
              <thead>
                <tr><th scope="col">User</th><th scope="col">Type</th><th scope="col">Profiles</th><th scope="col">Subscription</th><th scope="col">Joined</th><th scope="col">Account access</th></tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const banned = user.is_banned == 1
                  const name = userName(user)
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="ml-avatar">
                            <span className="user-avatar-initial" aria-hidden="true">{userName(user).slice(0, 1).toUpperCase()}</span>
                            <span
                              className="ml-dot"
                              aria-hidden="true"
                              style={{ background: banned ? 'var(--danger)' : user.is_subscribe == 1 ? 'var(--success)' : 'var(--muted-2)' }}
                            />
                          </span>
                          <span className="ml-id">
                            <Link to={`/admin/user/${user.id}` as any} className="ml-name">{name}</Link>
                            <span className="ml-sub">{user.email ?? 'No email provided'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="capitalize">{(user.user_type ?? 'user').replaceAll('_', ' ')}</td>
                      <td className="tabular-nums">{user.profiles ?? 0}</td>
                      <td><SubscriptionPill subscribed={user.is_subscribe == 1} /></td>
                      <td className="whitespace-nowrap tabular-nums">{user.created_at ? String(user.created_at).slice(0, 10) : '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <AccessToggle
                            user={user}
                            name={name}
                            banned={banned}
                            busy={busyId === user.id}
                            blocked={busyId !== null && busyId !== user.id}
                            onToggle={() => void toggleBan(user.id, !banned, name)}
                          />
                          <span className="text-xs">{busyId === user.id ? 'Updating…' : banned ? 'Banned' : user.user_type === 'admin' ? 'Protected' : 'Allowed'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:hidden" aria-label="Users">
            {filtered.map((user) => {
              const banned = user.is_banned == 1
              const name = userName(user)
              return (
                <li key={user.id} className="panel min-w-0 overflow-visible p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="ml-avatar mt-0.5">
                      <span className="user-avatar-initial" aria-hidden="true">{userName(user).slice(0, 1).toUpperCase()}</span>
                      <span
                        className="ml-dot"
                        aria-hidden="true"
                        style={{ background: banned ? 'var(--danger)' : user.is_subscribe == 1 ? 'var(--success)' : 'var(--muted-2)' }}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/user/${user.id}` as any} className="cell-title break-words hover:text-primary">{name}</Link>
                      <p className="cell-sub break-words">{user.email ?? 'No email provided'}</p>
                    </div>
                    <SubscriptionPill subscribed={user.is_subscribe == 1} />
                  </div>
                  <dl className="mb-4 mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Account type</dt><dd className="m-0 mt-1 capitalize text-foreground">{(user.user_type ?? 'user').replaceAll('_', ' ')}</dd></div>
                    <div><dt className="text-muted-foreground">Profiles</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{user.profiles ?? 0}</dd></div>
                    <div className="col-span-2"><dt className="text-muted-foreground">Joined</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{user.created_at ? String(user.created_at).slice(0, 10) : '—'}</dd></div>
                  </dl>
                  <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground" aria-live="polite">
                      {busyId === user.id ? 'Updating account access…' : banned ? 'Account access banned' : user.user_type === 'admin' ? 'Admin account protected' : 'Account access allowed'}
                    </span>
                    <AccessToggle
                      user={user}
                      name={name}
                      banned={banned}
                      busy={busyId === user.id}
                      blocked={busyId !== null && busyId !== user.id}
                      onToggle={() => void toggleBan(user.id, !banned, name)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
