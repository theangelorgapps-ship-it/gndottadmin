import { createFileRoute } from '@tanstack/react-router'
import { adminListSubscriptions } from '../../lib/admin'

export const Route = createFileRoute('/admin/subscriptions')({
  loader: async () => await adminListSubscriptions(),
  component: AdminSubscriptions,
})

function AdminSubscriptions() {
  const { subscriptions, transactions } = Route.useLoaderData()
  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Subscriptions</span></div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Active & past subscriptions</h3>
        <table className="admin-table">
          <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>
            {subscriptions.map((s: any) => (
              <tr key={s.id}>
                <td>{s.user_email ?? '—'}</td>
                <td><span className="cell-title">{s.plan_name ?? '—'}</span></td>
                <td>${Number(s.total_amount ?? s.amount ?? 0).toFixed(2)}</td>
                <td>{s.start_date ? String(s.start_date).slice(0, 10) : '—'}</td>
                <td>{s.end_date ? String(s.end_date).slice(0, 10) : '—'}</td>
                <td><span className={`pill ${s.status == 1 ? 'on' : 'off'}`}>{s.status == 1 ? 'Active' : 'Ended'}</span></td>
              </tr>
            ))}
            {subscriptions.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 26 }}>No subscriptions yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Transactions</h3>
        <table className="admin-table">
          <thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {transactions.map((t: any) => (
              <tr key={t.id}>
                <td className="cell-sub">{t.transaction_id ?? `#${t.id}`}</td>
                <td>{t.user_email ?? '—'}</td>
                <td>${Number(t.amount ?? 0).toFixed(2)}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.payment_type ?? '—'}</td>
                <td><span className={`pill ${t.payment_status === 'paid' ? 'on' : 'warn'}`}>{t.payment_status}</span></td>
                <td>{t.created_at ? String(t.created_at).slice(0, 10) : '—'}</td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 26 }}>No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
