import { createServerFn } from '@tanstack/react-start'
import { all, first, run } from './db'
import { requireAdmin } from './admin'

// Giving administration: donations from the player's Giving tab (Offering,
// Tithe, Partnership — one-time or monthly, Seed), with totals per campaign.
// Abandoned checkouts (pending > 24 h) are marked expired and hidden so the
// tab reflects real gifts, not remount clutter.

export type DonationRow = {
  id: string; name: string; email: string; country: string;
  kind: string; frequency: 'one_time' | 'monthly'; amount_cents: number; currency: string;
  status: string; created_at: string; paid_at: string | null
}

export const adminListDonations = createServerFn({ method: 'GET' })
  .validator((d: { kind?: string } | undefined) => ({ kind: d?.kind && ['offering', 'tithe', 'partner', 'seed'].includes(d.kind) ? d.kind : '' }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await run(`UPDATE donations SET status='expired' WHERE status='pending' AND created_at < datetime('now','-24 hours')`).catch(() => null)
    const where = data.kind ? `WHERE kind = ? AND status != 'expired'` : `WHERE status != 'expired'`
    const params = data.kind ? [data.kind] : []
    const donations = await all<DonationRow>(
      `SELECT id, name, email, country, kind, frequency, amount_cents, currency, status, created_at, paid_at
       FROM donations ${where} ORDER BY created_at DESC LIMIT 300`, ...params)
    const totals = await all<any>(
      `SELECT kind, frequency,
         SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END) AS paid_cents,
         SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
       FROM donations GROUP BY kind, frequency`)
    const summary = await first<any>(
      `SELECT SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END) AS total_cents,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS gifts,
        SUM(CASE WHEN status='paid' AND frequency='monthly' THEN 1 ELSE 0 END) AS monthly_partners
       FROM donations`)
    return { donations, totals, summary: { totalCents: Number(summary?.total_cents ?? 0), gifts: Number(summary?.gifts ?? 0), monthlyPartners: Number(summary?.monthly_partners ?? 0) } }
  })
