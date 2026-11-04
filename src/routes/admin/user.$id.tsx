import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminUserDetail, adminSetUserBanned } from '../../lib/admin'
import { img } from '../../components/Poster'

export const Route = createFileRoute('/admin/user/$id')({
  loader: async ({ params }) => await adminUserDetail({ data: Number(params.id) }),
  component: UserDetail,
})

function UserDetail() {
  const { user, subscription, reviews, watchlistCount, rents, profiles } = Route.useLoaderData() as any
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const banned = user.is_banned == 1
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '—'

  async function toggleBan() {
    setBusy(true)
    setError(null)
    try {
      await adminSetUserBanned({ data: { id: user.id, banned: !banned } })
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/admin/users">Users</Link> <span className="sep">/</span> <span className="here">{name}</span>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="ud-grid">
        <div className="ud-card">
          <div className="ud-head">
            <img className="ud-avatar" src={img(user.file_url)} alt={name} />
            <div>
              <h2>{name}</h2>
              <div className="cell-sub">{user.email}</div>
              <div className="ud-pills">
                <span className="pill on">{(user.user_type ?? 'user').replace('_', ' ')}</span>
                <span className={`pill ${user.status == 1 ? 'on' : 'off'}`}>{user.status == 1 ? 'Active' : 'Inactive'}</span>
                {banned && <span className="pill off">Banned</span>}
              </div>
            </div>
          </div>
          <div className="ud-rows">
            <div><span>Mobile</span><b>{user.mobile ?? '—'}</b></div>
            <div><span>Gender</span><b>{user.gender ?? '—'}</b></div>
            <div><span>Date of Birth</span><b>{user.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '—'}</b></div>
            <div><span>Login Type</span><b>{user.login_type ?? '—'}</b></div>
            <div><span>Joined</span><b>{user.created_at ? String(user.created_at).slice(0, 10) : '—'}</b></div>
            <div><span>Watchlist</span><b>{watchlistCount} titles</b></div>
          </div>
          {user.user_type !== 'admin' && (
            <button className={`btn ${banned ? 'btn-primary' : 'btn-danger'}`} onClick={toggleBan} disabled={busy}>
              {busy ? 'Working…' : banned ? 'Unban User' : 'Ban User'}
            </button>
          )}
        </div>

        <div className="ud-card">
          <h3>Subscription</h3>
          {subscription ? (
            <div className="ud-rows">
              <div><span>Plan</span><b>{subscription.plan_name ?? subscription.name ?? '—'}</b></div>
              <div><span>Status</span><b style={{ textTransform: 'capitalize' }}>{subscription.status}</b></div>
              <div><span>Started</span><b>{subscription.start_date ? String(subscription.start_date).slice(0, 10) : '—'}</b></div>
              <div><span>Expires</span><b>{subscription.end_date ? String(subscription.end_date).slice(0, 10) : '—'}</b></div>
              <div><span>Amount</span><b>${Number(subscription.total_amount ?? 0).toFixed(2)}</b></div>
            </div>
          ) : (
            <div className="empty" style={{ padding: 18 }}>No subscription.</div>
          )}
          <h3 style={{ marginTop: 20 }}>Profiles ({profiles.length})</h3>
          <div className="ud-profiles">
            {profiles.map((p: any) => (
              <div className="ud-profile" key={p.id}>
                <img src={img(p.avatar)} alt={p.name} />
                <span>{p.name}{p.is_child_profile == 1 ? ' (Kids)' : ''}</span>
              </div>
            ))}
            {profiles.length === 0 && <div className="cell-sub">No profiles.</div>}
          </div>
        </div>
      </div>

      <div className="ud-grid" style={{ marginTop: 18 }}>
        <div className="ud-card">
          <h3>Recent Reviews</h3>
          {reviews.length === 0 ? (
            <div className="empty" style={{ padding: 18 }}>No reviews.</div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Content</th><th>Rating</th><th>Review</th><th>Date</th></tr></thead>
              <tbody>
                {reviews.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.content ?? '—'}</td>
                    <td>{'★'.repeat(Math.round(r.rating || 0))}</td>
                    <td className="cell-sub">{r.review}</td>
                    <td>{r.created_at ? String(r.created_at).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="ud-card">
          <h3>Rent / Pay-Per-View History</h3>
          {rents.length === 0 ? (
            <div className="empty" style={{ padding: 18 }}>No rentals.</div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Title</th><th>Type</th><th>Price</th><th>Expiry</th></tr></thead>
              <tbody>
                {rents.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.title ?? '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                    <td>${Number(r.price ?? 0).toFixed(2)}</td>
                    <td>{r.view_expiry_date ? String(r.view_expiry_date).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
