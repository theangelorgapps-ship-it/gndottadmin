// Server boundary for the media ingest pipeline: binds the environment-agnostic core
// (media-ingest-core.ts) to Cloudflare D1, the settings table, and the live Bunny API.
import { env } from 'cloudflare:workers'
import { all, first } from './db'
import { requireAdmin } from './admin'
import {
  createIngestJob,
  refreshIngestJobs as refreshCore,
  cancelIngestJob as cancelCore,
  retryIngestJob as retryCore,
  type BunnyClient, type IngestInput, type IngestJob, type IngestStore,
} from './media-ingest-core'

type BunnySettings = { libraryId: string; apiKey: string; apiBase: string }

async function bunnySettings(): Promise<BunnySettings | null> {
  const rows = await all(`SELECT name, val FROM settings WHERE name IN ('bunny_library_id', 'bunny_api_key', 'bunny_api_base')`)
  const map: Record<string, string> = {}
  for (const r of rows as any[]) map[r.name] = r.val ?? ''
  if (!map.bunny_library_id || !map.bunny_api_key) return null
  return {
    libraryId: map.bunny_library_id,
    apiKey: map.bunny_api_key,
    // Optional override used by local/staging verification against a mock Bunny server.
    apiBase: /^https?:\/\/[^\s]+$/.test(map.bunny_api_base ?? '') ? map.bunny_api_base : 'https://video.bunnycdn.com',
  }
}

const UNCONFIGURED = 'Bunny Stream is not configured. Set the Library ID and API Key in Settings → Bunny Stream.'

function bunnyClient({ libraryId, apiKey, apiBase }: BunnySettings): BunnyClient {
  const call = async (method: string, path: string, body?: unknown) => {
    const resp = await fetch(`${apiBase}/library/${libraryId}${path}`, {
      method,
      headers: { AccessKey: apiKey, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const json: any = await resp.json().catch(() => null)
    return { status: resp.status, json }
  }
  return {
    async fetchVideo({ url, title }) {
      const { status, json } = await call('POST', '/videos/fetch', { url, title })
      if (status === 429) return { ok: false, error: 'Bunny is busy with other fetches. Try again in a moment.' }
      if (json && json.success === false) return { ok: false, error: String(json.message ?? 'Bunny Stream rejected the fetch.').slice(0, 300) }
      if (status >= 400) return { ok: false, error: `Bunny API error ${status}. Check the Bunny Stream settings.` }
      return { ok: true }
    },
    async listVideos() {
      const { status, json } = await call('GET', '/videos?page=1&itemsPerPage=100&orderBy=date')
      if (status >= 400 || !json) return []
      return (json.items ?? []).map((v: any) => ({ guid: v.guid, title: v.title, dateUploaded: v.dateUploaded }))
    },
    async getVideo(guid) {
      const { status, json } = await call('GET', `/videos/${guid}`)
      if (status >= 400 || !json) throw new Error(`Bunny API error ${status}.`)
      return {
        status: json.status,
        encodeProgress: json.encodeProgress,
        length: json.length,
        thumbnailUrl: json.thumbnailUrl ?? null,
        availableResolutions: json.availableResolutions ?? null,
        transcodingMessages: json.transcodingMessages ?? null,
      }
    },
    async deleteVideo(guid) {
      await call('DELETE', `/videos/${guid}`)
    },
  }
}

// ---------- D1 adapter for the core's IngestStore port ----------

const CONTENT_TABLES = ['entertainments', 'episodes', 'videos', 'seasons'] as const
const JOB_COLUMNS = ['dropbox_url', 'fetch_url', 'title', 'destination', 'series_id', 'season_id', 'content_table', 'content_id', 'bunny_video_id', 'phase', 'progress', 'bunny_status', 'thumbnail_url', 'duration', 'resolutions', 'error', 'created_at'] as const

function d1IngestStore(): IngestStore {
  const db = () => (env as any).DB
  return {
    async insertJob(job) {
      const keys = JOB_COLUMNS.filter(key => (job as any)[key] !== undefined)
      const res = await db().prepare(
        `INSERT INTO media_ingest_jobs (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      ).bind(...keys.map(key => (job as any)[key])).run()
      return Number(res.meta?.last_row_id)
    },
    async updateJob(id, patch) {
      const keys = JOB_COLUMNS.filter(key => (patch as any)[key] !== undefined)
      if (!keys.length) return
      await db().prepare(
        `UPDATE media_ingest_jobs SET ${keys.map(key => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ).bind(...keys.map(key => (patch as any)[key]), id).run()
    },
    async getJob(id) {
      return first<IngestJob>(`SELECT * FROM media_ingest_jobs WHERE id = ?`, id)
    },
    async listJobs() {
      return all<IngestJob>(`SELECT * FROM media_ingest_jobs ORDER BY id DESC LIMIT 50`)
    },
    async activeJobs() {
      return all<IngestJob>(`SELECT * FROM media_ingest_jobs WHERE phase IN ('fetching', 'transcoding') ORDER BY id`)
    },
    async claimedVideoIds() {
      const rows = await all<{ bunny_video_id: string }>(`SELECT bunny_video_id FROM media_ingest_jobs WHERE bunny_video_id IS NOT NULL`)
      return rows.map(row => row.bunny_video_id)
    },
    async insertContent(table, data) {
      if (!CONTENT_TABLES.includes(table)) throw new Error('Invalid content target.')
      const keys = Object.keys(data).filter(key => /^[a-z_]+$/.test(key))
      const res = await db().prepare(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      ).bind(...keys.map(key => (data as any)[key])).run()
      return Number(res.meta?.last_row_id)
    },
    async attachContentGuid(table, id, guid) {
      if (!CONTENT_TABLES.includes(table) || table === 'seasons') throw new Error('Invalid content target.')
      await db().prepare(`UPDATE ${table} SET bunny_video_url = ?, video_upload_type = 'bunny', updated_at = datetime('now') WHERE id = ?`).bind(guid, id).run()
    },
    async softDeleteContent(table, id) {
      if (!CONTENT_TABLES.includes(table)) throw new Error('Invalid content target.')
      await db().prepare(`UPDATE ${table} SET deleted_at = datetime('now') WHERE id = ?`).bind(id).run()
    },
    async mapContent(table, id, { genreIds = [], castIds = [], locationIds = [], productIds = [] }) {
      if (!CONTENT_TABLES.includes(table) || table === 'seasons') throw new Error('Invalid content target.')
      const stmts = []
      // Genres and personalities only have mapping tables for entertainments rows.
      if (table === 'entertainments') {
        for (const gid of genreIds) stmts.push(db().prepare(`INSERT INTO entertainment_gener_mapping (entertainment_id, genre_id, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).bind(id, gid))
        for (const tid of castIds) stmts.push(db().prepare(`INSERT INTO entertainment_talent_mapping (entertainment_id, talent_id, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).bind(id, tid))
      }
      const contentType = table === 'entertainments' ? 'entertainment' : table === 'episodes' ? 'episode' : 'video'
      for (const lid of locationIds) stmts.push(db().prepare(`INSERT INTO content_location_mapping (content_type, content_id, location_id) VALUES (?, ?, ?)`).bind(contentType, id, lid))
      if (stmts.length) await db().batch(stmts)
      // Shop products map onto the public app's content types (sermons are
      // 'movie' rows in entertainments; episodes/videos map directly).
      if (productIds.length) {
        const productContentType = table === 'episodes' ? 'episode' : table === 'videos' ? 'video'
          : (await first<{ type: string }>(`SELECT type FROM entertainments WHERE id = ?`, id))?.type
        if (!productContentType || !['movie', 'tvshow', 'teaching', 'episode', 'video'].includes(productContentType)) throw new Error('Products cannot be attached to this content type.')
        const productStmts = productIds.map(pid => db().prepare(`INSERT INTO content_products (content_type, content_id, product_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).bind(productContentType, id, pid))
        await db().batch(productStmts)
      }
    },
  }
}

export async function bunnyPipeline() {
  const settings = await bunnySettings()
  if (!settings) throw new Error(UNCONFIGURED)
  return { store: d1IngestStore(), bunny: bunnyClient(settings), settings }
}

// ---------- inner handlers (wrapped by media-ingest.ts as server functions) ----------

export async function ingestDropbox(data: IngestInput): Promise<IngestJob> {
  await requireAdmin()
  const { store, bunny } = await bunnyPipeline()
  return createIngestJob(store, bunny, data)
}

export async function listJobsResponse() {
  await requireAdmin()
  const settings = await bunnySettings()
  if (!settings) return { configured: false as const, libraryId: null, jobs: [] }
  const jobs = await d1IngestStore().listJobs()
  return { configured: true as const, libraryId: settings.libraryId, jobs }
}

export async function refreshJobsResponse() {
  await requireAdmin()
  const settings = await bunnySettings()
  if (!settings) return { configured: false as const, libraryId: null, jobs: [] }
  await refreshCore(d1IngestStore(), bunnyClient(settings))
  const jobs = await d1IngestStore().listJobs()
  return { configured: true as const, libraryId: settings.libraryId, jobs }
}

export async function cancelJob(id: number) {
  await requireAdmin()
  const { store, bunny } = await bunnyPipeline()
  await cancelCore(store, bunny, id)
  return { ok: true }
}

export async function retryJob(id: number) {
  await requireAdmin()
  const { store, bunny } = await bunnyPipeline()
  return retryCore(store, bunny, id)
}

export async function formOptionsResponse() {
  await requireAdmin()
  const settings = await bunnySettings()
  const [shows, teachings, seasons] = await Promise.all([
    all(`SELECT id, name FROM entertainments WHERE type = 'tvshow' AND deleted_at IS NULL ORDER BY name`),
    all(`SELECT id, name FROM entertainments WHERE type = 'teaching' AND deleted_at IS NULL ORDER BY name`),
    all(`SELECT s.id, s.name, s.entertainment_id FROM seasons s JOIN entertainments e ON e.id = s.entertainment_id
      WHERE s.deleted_at IS NULL AND e.deleted_at IS NULL AND e.type IN ('tvshow', 'teaching') ORDER BY s.name`),
  ])
  return { configured: !!settings, shows, teachings, seasons }
}
