import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminUserDetail, adminSetUserBanned } from '../../lib/admin'
import { img } from '../../components/Poster'

export const Route = createFileRoute('/admin/user/$id')({
  loader: async ({ params }) => await adminUserDetail({ data: Number(params.id) }),
  component: UserDetail,
})

function formatDate(value: unknown) {
  return value ? String(value).slice(0, 10) : '—'
}

function rentalType(type: unknown) {
  const labels: Record<string, string> = {
    movie: 'Sermon',
    tvshow: 'Show',
    teaching: 'Teaching',
    video: 'Video',
    episode: 'Episode',
  }
  return labels[String(type)] ?? String(type ?? 'Content').replaceAll('_', ' ')
}

function UserDetail() {
  const { user, subscription, watchlistCount, rents, profiles } = Route.useLoaderData() as any
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const banned = user.is_banned == 1
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || `User #${user.id}`

  async function toggleBan() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await adminSetUserBanned({ data: { id: user.id, banned: !banned } })
      setNotice(banned ? 'Account access restored.' : 'Account access banned.')
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'The account could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const subscriptionActive = subscription && (subscription.status == 1 || subscription.status === 'active')

  return (
    <div className="min-w-0">
      <div className="breadcrumb">
        <Link to="/admin/users">Users</Link> <span className="sep">/</span> <span className="here">{name}</span>
      </div>
      <div className="mb-5">
        <h1 className="m-0 break-words">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account details, subscription, profiles, and purchase history.</p>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="mb-4 rounded-md border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.1)] px-3 py-2 text-sm text-[var(--success)]" role="status">{notice}</div>}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <section className="panel overflow-visible" aria-labelledby="account-overview-heading">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <img className="ud-avatar h-20 w-20" src={img(user.file_url)} alt="" />
            <div className="min-w-0 flex-1">
              <h2 id="account-overview-heading" className="m-0 break-words text-lg">Account overview</h2>
              {user.email ? <a href={`mailto:${user.email}`} className="mt-1 block break-words text-sm text-primary hover:underline">{user.email}</a> : <p className="cell-sub">No email provided</p>}
              <div className="ud-pills">
                <span className="pill info capitalize">{(user.user_type ?? 'user').replaceAll('_', ' ')}</span>
                <span className={`pill ${user.status == 1 ? 'on' : 'off'}`}>{user.status == 1 ? 'Active' : 'Inactive'}</span>
                <span className={`pill ${banned ? 'off' : 'on'}`}>{banned ? 'Banned' : 'Access allowed'}</span>
              </div>
            </div>
          </div>

          <dl className="mb-0 mt-6 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {[
              ['Mobile', user.mobile ?? '—'],
              ['Gender', user.gender ?? '—'],
              ['Date of birth', formatDate(user.date_of_birth)],
              ['Login type', user.login_type ?? '—'],
              ['Joined', formatDate(user.created_at)],
              ['Saved titles', `${Number(watchlistCount ?? 0).toLocaleString()} titles`],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-3 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="m-0 break-words text-right font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t border-border pt-4">
            {user.user_type === 'admin' ? (
              <p className="m-0 text-sm text-muted-foreground">Admin accounts are protected from access changes.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={`btn ${banned ? 'btn-primary' : 'btn-danger'}`}
                  onClick={() => void toggleBan()}
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? 'Updating…' : banned ? 'Restore account access' : 'Ban account access'}
                </button>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {busy ? 'Saving the account change.' : banned ? 'This account cannot sign in.' : 'This account can sign in.'}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="panel overflow-visible" aria-labelledby="subscription-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="subscription-heading" className="m-0 text-base font-semibold">Current Subscription</h2>
            {subscription && <span className={`pill ${subscriptionActive ? 'on' : 'off'}`}>{subscriptionActive ? 'Active' : 'Ended'}</span>}
          </div>
          {subscription ? (
            <dl className="m-0">
              {[
                ['Plan', subscription.plan_name ?? subscription.name ?? '—'],
                ['Started', formatDate(subscription.start_date)],
                ['Expires', formatDate(subscription.end_date)],
                ['Amount', `$${Number(subscription.total_amount ?? 0).toFixed(2)}`],
                ['Duration', subscription.duration ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-3 text-sm last:border-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="m-0 break-words text-right font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="empty px-3 py-8">
              <p className="font-medium text-foreground">No subscription</p>
              <p className="mt-1 text-sm">This account does not have a current subscription record.</p>
            </div>
          )}
          <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
            <span className="text-muted-foreground">Subscription access</span>
            <p className="mb-0 mt-1 font-medium text-foreground">{user.is_subscribe == 1 ? 'Subscriber features enabled' : 'Subscriber features not enabled'}</p>
          </div>
        </section>
      </div>

      <section className="panel mt-4 overflow-visible" aria-labelledby="profiles-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="profiles-heading" className="m-0 text-base font-semibold">Profiles</h2>
            <p className="mt-1 text-xs text-muted-foreground">Profiles attached to this account</p>
          </div>
          <span className="pill info">{profiles.length}</span>
        </div>
        {profiles.length === 0 ? (
          <div className="empty px-3 py-8">
            <p className="font-medium text-foreground">No profiles</p>
            <p className="mt-1 text-sm">Profiles created by this user will appear here.</p>
          </div>
        ) : (
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {profiles.map((profile: any) => (
              <li key={profile.id} className="min-w-0 rounded-lg border border-border bg-background p-3 text-center">
                <img src={img(profile.avatar)} alt="" className="mx-auto h-14 w-14 rounded-md border border-border object-cover" />
                <p className="mb-0 mt-2 break-words text-sm font-medium text-foreground">{profile.name}</p>
                <p className="mb-0 mt-0.5 text-xs text-muted-foreground">{profile.is_child_profile == 1 ? 'Kids profile' : 'Standard profile'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel mt-4 overflow-visible" aria-labelledby="rentals-heading">
        <div className="mb-4">
          <h2 id="rentals-heading" className="m-0 text-base font-semibold">Rent / Pay-Per-View History</h2>
          <p className="mt-1 text-xs text-muted-foreground">Recent purchases and their viewing expiry dates</p>
        </div>
        {rents.length === 0 ? (
          <div className="empty px-3 py-8">
            <p className="font-medium text-foreground">No rentals</p>
            <p className="mt-1 text-sm">Pay-per-view purchases will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-scroll hidden md:block" role="region" aria-label="Scrollable purchase history table" tabIndex={0}>
              <table className="admin-table">
                <thead><tr><th scope="col">Title</th><th scope="col">Type</th><th scope="col">Price</th><th scope="col">Purchased</th><th scope="col">Expiry</th></tr></thead>
                <tbody>
                  {rents.map((rent: any) => (
                    <tr key={rent.id}>
                      <td><span className="cell-title">{rent.title ?? '—'}</span></td>
                      <td>{rentalType(rent.type)}</td>
                      <td className="tabular-nums">${Number(rent.price ?? 0).toFixed(2)}</td>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(rent.created_at)}</td>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(rent.view_expiry_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:hidden" aria-label="Purchase history">
              {rents.map((rent: any) => (
                <li key={rent.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 break-words font-medium text-foreground">{rent.title ?? '—'}</p>
                      <p className="cell-sub">{rentalType(rent.type)}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">${Number(rent.price ?? 0).toFixed(2)}</span>
                  </div>
                  <dl className="mb-0 mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Purchased</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{formatDate(rent.created_at)}</dd></div>
                    <div><dt className="text-muted-foreground">Viewing expiry</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{formatDate(rent.view_expiry_date)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
