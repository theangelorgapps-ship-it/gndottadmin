// Bulk upload core: environment-agnostic logic for the Excel-driven bulk import.
// Parsing/mapping/detection are pure; importing runs against port interfaces so the
// gate exercises real logic against an in-memory store and a scripted Bunny client.
import {
  createIngestJob,
  normalizeDropboxUrl,
  type BunnyClient,
  type IngestDestination,
  type IngestInput,
  type IngestStore,
} from './media-ingest-core'

export type BulkField =
  | 'title' | 'destination' | 'video' | 'series' | 'season'
  | 'categories' | 'preacher' | 'location' | 'description' | 'releaseDate' | 'access'
  | 'products'

// Header auto-mapping: lowercase alias matching, tolerant of punctuation and plurals.
export const HEADER_ALIASES: Record<BulkField, string[]> = {
  title: ['title', 'name', 'sermon title', 'video title'],
  destination: ['destination', 'section', 'type'],
  video: ['video', 'video source', 'video url', 'dropbox', 'dropbox link', 'bunny id', 'bunny video id', 'source'],
  series: ['series', 'show', 'teaching series', 'volume series'],
  season: ['season', 'volume'],
  categories: ['categories', 'category', 'genre', 'genres'],
  preacher: ['preacher', 'preachers', 'speaker', 'pastor', 'personality', 'minister'],
  location: ['location', 'locations', 'church', 'venue'],
  description: ['description', 'desc', 'summary', 'about'],
  releaseDate: ['release date', 'released', 'date'],
  access: ['access', 'pricing', 'price type'],
  products: ['products', 'product', 'product ids', 'shop products', 'store products', 'recommended resources', 'resources'],
}

const normalizeHeader = (value: unknown): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Maps each spreadsheet column to a field; null means "ignore this column". */
export function autoMapHeaders(headers: unknown[]): (BulkField | null)[] {
  const taken = new Set<BulkField>()
  return headers.map(header => {
    const normalized = normalizeHeader(header)
    if (!normalized) return null
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [BulkField, string[]][]) {
      if (!taken.has(field) && aliases.some(alias => normalized === alias || normalized.includes(alias))) {
        taken.add(field)
        return field
      }
    }
    return null
  })
}

const BUNNY_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type VideoSource = { kind: 'dropbox' | 'bunny' | 'invalid'; value: string }

/** A video cell is either a Dropbox shared link or a Bunny video reference. */
export function detectVideoSource(value: unknown): VideoSource {
  const input = String(value ?? '').trim()
  const dropbox = normalizeDropboxUrl(input)
  if (dropbox) return { kind: 'dropbox', value: dropbox }
  if (BUNNY_GUID.test(input)) return { kind: 'bunny', value: input.toLowerCase() }
  // Full Bunny CDN / embed URLs carry the GUID as one of the path segments.
  try {
    const url = new URL(input)
    const segment = url.pathname.split('/').filter(Boolean).find(part => BUNNY_GUID.test(part))
    if (segment) return { kind: 'bunny', value: segment.toLowerCase() }
  } catch { /* not a URL */ }
  return { kind: 'invalid', value: input }
}

const DESTINATIONS: Record<string, IngestDestination> = {
  sermon: 'sermon', sermons: 'sermon', movie: 'sermon',
  teaching: 'teaching', teachings: 'teaching', 'teaching series': 'teaching',
  show: 'show', shows: 'show', tvshow: 'show', 'tv show': 'show',
  video: 'video', videos: 'video', clip: 'video',
}

const VALID_DESTINATIONS: IngestDestination[] = ['sermon', 'teaching', 'show', 'video']

export function normalizeDestination(value: unknown): IngestDestination | null {
  return DESTINATIONS[normalizeHeader(value)] ?? null
}

const splitNames = (value: unknown): string[] =>
  String(value ?? '').split(/[;,]/).map(name => name.trim()).filter(Boolean).slice(0, 20)

/** A products cell is comma/semicolon-separated WooCommerce product IDs. */
export function parseProductIds(value: unknown): { ids: number[]; invalid: string[] } {
  const tokens = String(value ?? '').split(/[;,]/).map(token => token.trim()).filter(Boolean).slice(0, 20)
  const ids: number[] = []
  const invalid: string[] = []
  for (const token of tokens) {
    const id = Number(token)
    if (Number.isSafeInteger(id) && id > 0) { if (!ids.includes(id)) ids.push(id) }
    else invalid.push(token)
  }
  return { ids: ids.slice(0, 12), invalid }
}

export type BulkRow = {
  index: number // 1-based spreadsheet row (header is row 1)
  title: string
  destination: IngestDestination | null
  video: VideoSource
  series: string
  season: string
  categories: string[]
  preachers: string[]
  locations: string[]
  description: string
  releaseDate: string
  access: string
  productIds: number[]
  errors: string[]
  warnings: string[]
}

/** Turns the raw cell matrix into validated rows using the confirmed column mapping. */
export function parseBulkRows(matrix: unknown[][], mapping: (BulkField | null)[]): BulkRow[] {
  const rows: BulkRow[] = []
  for (let r = 0; r < matrix.length; r++) {
    const cells = matrix[r] ?? []
    const fieldOf = (field: BulkField) => {
      const column = mapping.indexOf(field)
      return column === -1 ? '' : String(cells[column] ?? '').trim()
    }
    const products = parseProductIds(cells[mapping.indexOf('products')])
    const row: BulkRow = {
      index: r + 2,
      title: fieldOf('title').slice(0, 200),
      destination: normalizeDestination(fieldOf('destination')),
      video: detectVideoSource(fieldOf('video')),
      series: fieldOf('series').slice(0, 200),
      season: fieldOf('season').slice(0, 200),
      categories: splitNames(cells[mapping.indexOf('categories')]),
      preachers: splitNames(cells[mapping.indexOf('preacher')]),
      locations: splitNames(cells[mapping.indexOf('location')]),
      description: fieldOf('description'),
      releaseDate: fieldOf('releaseDate').slice(0, 40),
      access: ['free', 'paid', 'subscription'].includes(normalizeHeader(fieldOf('access'))) ? normalizeHeader(fieldOf('access')) : 'free',
      productIds: products.ids,
      errors: [],
      warnings: [],
    }
    const blank = !row.title && !fieldOf('destination') && !row.video.value
    if (blank) continue // skip empty spreadsheet rows silently
    if (!row.title) row.errors.push('Title is required.')
    if (!row.destination) row.errors.push(`Destination must be sermon, teaching, show or video (got "${fieldOf('destination') || 'empty'}").`)
    if (row.video.kind === 'invalid') row.errors.push('Video must be a Dropbox shared link or a Bunny video ID.')
    if ((row.destination === 'teaching' || row.destination === 'show') && !row.series) {
      row.errors.push(`${row.destination === 'teaching' ? 'Teaching' : 'Show'} rows need a Series name.`)
    }
    if (row.destination === 'video' && (row.categories.length || row.preachers.length)) {
      row.warnings.push('Categories and Preacher apply to sermons and series only; ignored for videos.')
    }
    if (products.invalid.length) row.warnings.push(`Ignored invalid product IDs: ${products.invalid.join(', ')}.`)
    if (products.ids.length > 12) row.warnings.push('Only the first 12 product IDs are attached.')
    rows.push(row)
  }
  return rows
}

/**
 * Server-side revalidation: rows arrive from the client preview, so their
 * errors and video source are untrusted. Recompute the load-bearing fields
 * (title, destination, video) from scratch before anything is written.
 */
export function revalidateBulkRows(rows: BulkRow[]): BulkRow[] {
  return rows.map(row => {
    const errors: string[] = []
    const title = String(row.title ?? '').trim().slice(0, 200)
    if (!title) errors.push('Title is required.')
    const destination = VALID_DESTINATIONS.includes(row.destination as IngestDestination)
      ? row.destination as IngestDestination : null
    if (!destination) errors.push('Destination must be sermon, teaching, show or video.')
    // Re-derive the video source from the raw value, never from the claimed kind.
    const video = detectVideoSource(row.video?.value)
    if (video.kind === 'invalid') errors.push('Video must be a Dropbox shared link or a Bunny video ID.')
    const series = String(row.series ?? '').trim().slice(0, 200)
    if ((destination === 'teaching' || destination === 'show') && !series) {
      errors.push(`${destination === 'teaching' ? 'Teaching' : 'Show'} rows need a Series name.`)
    }
    // Product IDs arrive from the client preview; re-derive safe integers only.
    const productIds = (Array.isArray(row.productIds) ? row.productIds : [])
      .map(Number).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 12)
    return { ...row, title, destination, video, series, productIds, errors }
  })
}

// ---------- importing ----------

/** Taxonomy port: resolve a name to an id, creating the record when missing. */
export type TaxonomyKind = 'genre' | 'preacher' | 'location' | 'series' | 'season'
export type TaxonomyStore = {
  resolve(kind: TaxonomyKind, name: string, context?: { seriesId?: number; seriesType?: 'teaching' | 'tvshow' }): Promise<{ id: number; created: boolean }>
  contentNameExists(table: 'entertainments' | 'episodes' | 'videos', name: string): Promise<boolean>
}

export type BulkOutcome = 'queued' | 'attached' | 'skipped-duplicate' | 'failed'
export type BulkResult = {
  index: number
  title: string
  destination: IngestDestination | null
  outcome: BulkOutcome
  createdNames: string[]
  error?: string
}

const CONTENT_TABLE = { sermon: 'entertainments', teaching: 'episodes', show: 'episodes', video: 'videos' } as const

/**
 * Imports validated rows. Dropbox rows go through the ingest pipeline (Bunny fetch +
 * transcoding, tracked by the widget); Bunny-ID rows attach immediately. Taxonomy is
 * mapped where the schema supports it: genres and preacher to sermons and series,
 * locations to every destination.
 */
export async function importBulkRows(
  rows: BulkRow[],
  deps: { tax: TaxonomyStore; store: IngestStore; bunny: BunnyClient },
): Promise<BulkResult[]> {
  const results: BulkResult[] = []
  for (const row of rows) {
    const created: string[] = []
    try {
      if (row.errors.length) {
        results.push({ index: row.index, title: row.title, destination: row.destination, outcome: 'failed', createdNames: [], error: row.errors[0] })
        continue
      }
      const destination = row.destination!
      const table = CONTENT_TABLE[destination]
      if (await deps.tax.contentNameExists(table, row.title)) {
        results.push({ index: row.index, title: row.title, destination, outcome: 'skipped-duplicate', createdNames: [] })
        continue
      }

      const resolveAll = async (kind: TaxonomyKind, names: string[], context?: { seriesId?: number; seriesType?: 'teaching' | 'tvshow' }) => {
        const ids: number[] = []
        for (const name of names) {
          const resolved = await deps.tax.resolve(kind, name, context)
          if (resolved.created) created.push(`${kind}: ${name}`)
          ids.push(resolved.id)
        }
        return ids
      }

      const episodic = destination === 'teaching' || destination === 'show'
      const seriesType = destination === 'show' ? 'tvshow' : 'teaching'
      const genreIds = await resolveAll('genre', row.categories)
      const castIds = await resolveAll('preacher', row.preachers)
      const locationIds = await resolveAll('location', row.locations)

      if (episodic) {
        const series = await deps.tax.resolve('series', row.series, { seriesType })
        if (series.created) {
          created.push(`series: ${row.series}`)
          // Taxonomy describes the series for episodic rows.
          await deps.store.mapContent('entertainments', series.id, { genreIds, castIds, locationIds })
        }
        const seasonName = row.season || 'Volume 1'
        const season = await deps.tax.resolve('season', seasonName, { seriesId: series.id })
        if (season.created) created.push(`season: ${seasonName}`)
        const input: IngestInput = {
          url: row.video.kind === 'dropbox' ? row.video.value : '',
          title: row.title,
          destination,
          seriesId: series.id,
          seasonId: season.id,
          description: row.description || undefined,
          releaseDate: row.releaseDate || undefined,
          access: row.access,
          genreIds, castIds, locationIds, productIds: row.productIds,
        }
        results.push(await importOne(row, destination, input, deps, created))
        continue
      }

      const input: IngestInput = {
        url: row.video.kind === 'dropbox' ? row.video.value : '',
        title: row.title,
        destination,
        description: row.description || undefined,
        releaseDate: row.releaseDate || undefined,
        access: row.access,
        genreIds, castIds, locationIds, productIds: row.productIds,
      }
      results.push(await importOne(row, destination, input, deps, created))
    } catch (e: any) {
      results.push({ index: row.index, title: row.title, destination: row.destination, outcome: 'failed', createdNames: created, error: e?.message ?? 'Import failed.' })
    }
  }
  return results
}

async function importOne(
  row: BulkRow,
  destination: IngestDestination,
  input: IngestInput,
  deps: { store: IngestStore; bunny: BunnyClient },
  created: string[],
): Promise<BulkResult> {
  if (row.video.kind === 'dropbox') {
    await createIngestJob(deps.store, deps.bunny, input)
    return { index: row.index, title: row.title, destination, outcome: 'queued', createdNames: created }
  }
  // Bunny-ID rows: the video is already in the library, attach without a fetch.
  await createIngestJob(deps.store, deps.bunny, { ...input, bunnyVideoId: row.video.value })
  return { index: row.index, title: row.title, destination, outcome: 'attached', createdNames: created }
}
