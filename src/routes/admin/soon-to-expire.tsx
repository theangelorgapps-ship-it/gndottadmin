import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { adminTable } from '../../lib/admin'

export const Route = createFileRoute('/admin/soon-to-expire')({
  loader: async () => await adminTable({ data: 'soon-to-expire' }),
  component: Page,
})

function formatDate(value: unknown) {
  return value ? String(value).slice(0, 10) : '—'
}

function daysRemaining(value: unknown): number | null {
  if (!value) return null
  const date = String(value).slice(0, 10)
  const expiry = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(expiry)) return null
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.ceil((expiry - today) / 86_400_000)
}

function ExpiryStatus({ value }: { value: unknown }) {
  const days = daysRemaining(value)
  if (days === null) return <span className="pill info">Date unavailable</span>
  if (days < 0) return <span className="pill off">Overdue</span>
  if (days === 0) return <span className="pill warn">Expires today</span>
  return <span className={`pill ${days <= 7 ? 'warn' : 'info'}`}>{days} {days === 1 ? 'day' : 'days'} left</span>
}

function Page() {
  const rows = Route.useLoaderData() as any[]
  const [query, setQuery] = useState('')
  const [window, setWindow] = useState('all')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !normalized || [row.user_email, row.name]
        .some((value) => String(value ?? '').toLowerCase().includes(normalized))
      const days = daysRemaining(row.end_date)
      const matchesWindow = window === 'all'
        || (window === 'overdue' && days !== null && days < 0)
        || (window === 'week' && days !== null && days >= 0 && days <= 7)
        || (window === 'month' && days !== null && days > 7 && days <= 30)
      return matchesQuery && matchesWindow
    })
  }, [rows, query, window])

  function clearFilters() {
    setQuery('')
    setWindow('all')
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Users <span className="sep">/</span> <span className="here">Soon to Expire</span></div>
      <div className="mb-5">
        <h1 className="m-0">Soon to Expire</h1>
        <p className="mt-1 text-sm text-muted-foreground">Active subscriptions ending within 30 days, ordered by expiry date.</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Expiry summary">
        <div className="panel overflow-visible p-4"><span className="text-xs text-muted-foreground">Subscriptions in expiry window</span><p className="mb-0 mt-1 text-2xl font-semibold tabular-nums">{rows.length.toLocaleString()}</p></div>
        <div className="panel overflow-visible p-4"><span className="text-xs text-muted-foreground">Next expiry</span><p className="mb-0 mt-1 text-2xl font-semibold tabular-nums">{rows.length > 0 ? formatDate(rows[0].end_date) : '—'}</p></div>
      </div>

      <div className="toolbar" aria-label="Expiry filters">
        <div className="min-w-0 flex-1">
          <label htmlFor="expiry-search" className="sr-only">Search expiring subscriptions</label>
          <input
            id="expiry-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user or plan…"
            className="min-h-11 w-full max-w-md md:min-h-10"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="expiry-window" className="sr-only">Filter by expiry window</label>
          <select id="expiry-window" className="min-h-11 md:min-h-10" value={window} onChange={(event) => setWindow(event.target.value)}>
            <option value="all">All expiry dates</option>
            <option value="overdue">Overdue</option>
            <option value="week">Next 7 days</option>
            <option value="month">8–30 days</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground" aria-live="polite">{filtered.length} of {rows.length} records</span>
      </div>

      {filtered.length === 0 ? (
        <div className="panel empty overflow-visible">
          <p className="font-medium text-foreground">{rows.length === 0 ? 'No upcoming expiries' : 'No matching subscriptions'}</p>
          <p className="mt-1 text-sm">{rows.length === 0 ? 'Active subscriptions approaching expiry will appear here.' : 'Try another search or expiry window.'}</p>
          {(query || window !== 'all') && <button type="button" className="btn btn-dark mt-4" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <section className="panel overflow-visible" aria-labelledby="expiry-records-heading">
          <div className="mb-4">
            <h2 id="expiry-records-heading" className="m-0 text-base font-semibold">Expiring Subscriptions</h2>
            <p className="mt-1 text-xs text-muted-foreground">Use these records to follow up before access ends.</p>
          </div>
          <div className="table-scroll hidden md:block" role="region" aria-label="Scrollable expiring subscriptions table" tabIndex={0}>
            <table className="admin-table">
              <thead><tr><th scope="col">User</th><th scope="col">Plan</th><th scope="col">Expires</th><th scope="col">Time remaining</th><th scope="col">Amount</th></tr></thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td><span className="cell-title break-words">{row.user_email ?? '—'}</span></td>
                    <td>{row.name ?? '—'}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatDate(row.end_date)}</td>
                    <td><ExpiryStatus value={row.end_date} /></td>
                    <td className="whitespace-nowrap font-medium tabular-nums">${Number(row.amount ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:hidden" aria-label="Expiring subscriptions">
            {filtered.map((row) => (
              <li key={row.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 break-words font-medium text-foreground">{row.name ?? '—'}</p>
                    <p className="cell-sub break-words">{row.user_email ?? 'No user email'}</p>
                  </div>
                  <ExpiryStatus value={row.end_date} />
                </div>
                <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-muted-foreground">Expiry date</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{formatDate(row.end_date)}</dd></div>
                  <div><dt className="text-muted-foreground">Amount</dt><dd className="m-0 mt-1 font-medium tabular-nums text-foreground">${Number(row.amount ?? 0).toFixed(2)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
