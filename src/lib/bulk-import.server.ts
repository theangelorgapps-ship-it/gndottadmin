// Server boundary for bulk upload: binds bulk-import-core to Cloudflare D1 and the
// live Bunny API. Imported only by bulk-import.ts (the RPC surface) — never by
// client code directly (import-protection blocks *.server.* in the client bundle).
import { env } from 'cloudflare:workers'
import { all, first } from './db'
import { requireAdmin } from './admin'
import { importBulkRows, revalidateBulkRows, type BulkRow, type TaxonomyStore } from './bulk-import-core'
import { bunnyPipeline } from './media-ingest.server'

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120) || 'item'

/** D1-backed taxonomy: find by name (case-insensitive) or create the record. */
function d1Taxonomy(): TaxonomyStore {
  const db = () => (env as any).DB
  return {
    async resolve(kind, name, context = {}) {
      const trimmed = name.trim().slice(0, 200)
      if (!trimmed) throw new Error('Empty name.')
      if (kind === 'genre') {
        const existing = await first<{ id: number }>(`SELECT id FROM genres WHERE lower(name) = lower(?) AND deleted_at IS NULL`, trimmed)
        if (existing) return { id: existing.id, created: false }
        const res = await db().prepare(`INSERT INTO genres (name, slug, status, created_at, updated_at) VALUES (?, ?, 1, datetime('now'), datetime('now'))`).bind(trimmed, slugify(trimmed)).run()
        return { id: Number(res.meta?.last_row_id), created: true }
      }
      if (kind === 'preacher') {
        const existing = await first<{ id: number }>(`SELECT id FROM cast_crew WHERE lower(name) = lower(?) AND deleted_at IS NULL`, trimmed)
        if (existing) return { id: existing.id, created: false }
        const res = await db().prepare(`INSERT INTO cast_crew (name, designation, status, created_at, updated_at) VALUES (?, 'Preacher', 1, datetime('now'), datetime('now'))`).bind(trimmed).run()
        return { id: Number(res.meta?.last_row_id), created: true }
      }
      if (kind === 'location') {
        const existing = await first<{ id: number }>(`SELECT id FROM locations WHERE lower(name) = lower(?) AND deleted_at IS NULL`, trimmed)
        if (existing) return { id: existing.id, created: false }
        const res = await db().prepare(`INSERT INTO locations (name, status, created_at, updated_at) VALUES (?, 1, datetime('now'), datetime('now'))`).bind(trimmed).run()
        return { id: Number(res.meta?.last_row_id), created: true }
      }
      if (kind === 'series') {
        const type = context.seriesType === 'tvshow' ? 'tvshow' : 'teaching'
        const existing = await first<{ id: number }>(`SELECT id FROM entertainments WHERE lower(name) = lower(?) AND type = ? AND deleted_at IS NULL`, trimmed, type)
        if (existing) return { id: existing.id, created: false }
        const res = await db().prepare(`INSERT INTO entertainments (name, type, slug, status, created_at, updated_at) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`).bind(trimmed, type, slugify(trimmed)).run()
        return { id: Number(res.meta?.last_row_id), created: true }
      }
      // season
      if (!context.seriesId) throw new Error('A season needs its series.')
      const existing = await first<{ id: number }>(`SELECT id FROM seasons WHERE lower(name) = lower(?) AND entertainment_id = ? AND deleted_at IS NULL`, trimmed, context.seriesId)
      if (existing) return { id: existing.id, created: false }
      const res = await db().prepare(`INSERT INTO seasons (name, entertainment_id, status, created_at, updated_at) VALUES (?, ?, 1, datetime('now'), datetime('now'))`).bind(trimmed, context.seriesId).run()
      return { id: Number(res.meta?.last_row_id), created: true }
    },
    async contentNameExists(table, name) {
      if (!['entertainments', 'episodes', 'videos'].includes(table)) return false
      // For sermons, only movie-type entertainments count as duplicates —
      // a teaching/show series may legitimately share a name.
      const rows = table === 'entertainments'
        ? await first<{ id: number }>(`SELECT id FROM entertainments WHERE lower(name) = lower(?) AND type = 'movie' AND deleted_at IS NULL`, name.trim())
        : await first<{ id: number }>(`SELECT id FROM ${table} WHERE lower(name) = lower(?) AND deleted_at IS NULL`, name.trim())
      return !!rows
    },
  }
}

export type BulkImportPayload = { rows: BulkRow[] }

/** Imports validated preview rows; returns one outcome per row, failures isolated. */
export async function importRows(payload: BulkImportPayload) {
  await requireAdmin()
  const rows = payload?.rows
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nothing to import.')
  if (rows.length > 500) throw new Error('Import up to 500 rows at a time.')
  const { store, bunny } = await bunnyPipeline()
  // Rows come from the client preview — re-derive their validation server-side.
  const results = await importBulkRows(revalidateBulkRows(rows), { tax: d1Taxonomy(), store, bunny })
  const summary = {
    queued: results.filter(r => r.outcome === 'queued').length,
    attached: results.filter(r => r.outcome === 'attached').length,
    skipped: results.filter(r => r.outcome === 'skipped-duplicate').length,
    failed: results.filter(r => r.outcome === 'failed').length,
  }
  return { results, summary }
}

/** Preview support: existing names the importer will match against. */
export async function importContext() {
  await requireAdmin()
  const [genres, preachers, locations] = await Promise.all([
    all(`SELECT name FROM genres WHERE deleted_at IS NULL ORDER BY name`),
    all(`SELECT name FROM cast_crew WHERE deleted_at IS NULL ORDER BY name LIMIT 1000`),
    all(`SELECT name FROM locations WHERE deleted_at IS NULL ORDER BY name`),
  ])
  return {
    genres: genres.map((r: any) => r.name),
    preachers: preachers.map((r: any) => r.name),
    locations: locations.map((r: any) => r.name),
  }
}
