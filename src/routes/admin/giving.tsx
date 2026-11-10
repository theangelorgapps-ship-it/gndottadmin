import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListDonations } from '../../lib/giving-admin'

export const Route = createFileRoute('/admin/giving')({
  loader: async () => await adminListDonations(),
  component: AdminGiving,
})

const KIND_LABEL: Record<string, string> = { offering: 'Offering', tithe: 'Tithe', partner: 'Partnership', seed: 'Seed' }
const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)

function AdminGiving() {
  const data = Route.useLoaderData()
  const [kind, setKind] = useState('')
  const [donations, setDonations] = useState(data.donations)

  async function filter(next: string) {
    setKind(next)
    const res = await adminListDonations({ data: { kind: next } })
    setDonations(res.donations)
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Giving</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Donations from the player's Giving tab — Offering, Tithe, Partnership (one-time or monthly), and Seed. A thank-you email goes out with each confirmed gift.</span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Total received</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{money(data.summary.totalCents)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Confirmed gifts</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{data.summary.gifts}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Monthly partners</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{data.summary.monthlyPartners}</p>
        </div>
      </div>

      <div className="mb-4 rounded-[14px] border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">By campaign</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">Campaign</th>
                <th className="px-2 py-2">Frequency</th>
                <th className="px-2 py-2">Received</th>
                <th className="px-2 py-2">Gifts</th>
                <th className="px-2 py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.totals.map((row: any) => (
                <tr key={`${row.kind}-${row.frequency}`} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium text-foreground">{KIND_LABEL[row.kind] ?? row.kind}</td>
                  <td className="px-2 py-2">{row.frequency === 'monthly' ? 'Monthly' : 'One-time'}</td>
                  <td className="px-2 py-2">{money(Number(row.paid_cents ?? 0))}</td>
                  <td className="px-2 py-2">{Number(row.paid_count ?? 0)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{Number(row.pending_count ?? 0)}</td>
                </tr>
              ))}
              {data.totals.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">No donations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Recent gifts</h2>
          <span className="spacer" />
          <select aria-label="Filter by campaign" value={kind} onChange={e => void filter(e.target.value)} className="max-w-44">
            <option value="">All campaigns</option>
            <option value="offering">Offering</option>
            <option value="tithe">Tithe</option>
            <option value="partner">Partnership</option>
            <option value="seed">Seed</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Donor</th>
                <th className="px-2 py-2">Country</th>
                <th className="px-2 py-2">Campaign</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {donations.map(d => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="px-2 py-2 text-muted-foreground">{String(d.created_at).slice(0, 16).replace('T', ' ')}</td>
                  <td className="max-w-52 break-words px-2 py-2"><span className="font-medium text-foreground">{d.name}</span><br /><span className="text-xs text-muted-foreground">{d.email}</span></td>
                  <td className="px-2 py-2">{d.country || '—'}</td>
                  <td className="px-2 py-2">{KIND_LABEL[d.kind] ?? d.kind}{d.frequency === 'monthly' ? ' · monthly' : ''}</td>
                  <td className="px-2 py-2 font-medium text-foreground">{money(d.amount_cents, d.currency.toUpperCase())}</td>
                  <td className="px-2 py-2"><span className={`pill ${d.status === 'paid' ? 'on' : 'info'}`}>{d.status === 'paid' ? 'Received' : d.status}</span></td>
                </tr>
              ))}
              {donations.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">No donations found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
