/** Rewrites a Dropbox shared link into the direct-download URL Bunny fetches. */
export function normalizeDropboxUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  const input = value.trim()
  if (!input) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    if (!['dropbox.com', 'www.dropbox.com', 'dl.dropbox.com', 'dl.dropboxusercontent.com'].includes(host)) return null
    if (!url.pathname || url.pathname === '/') return null
    url.hostname = 'dl.dropboxusercontent.com'
    url.searchParams.set('dl', '1')
    return url.href
  } catch {
    return null
  }
}

export type IngestPhase = 'fetching' | 'transcoding' | 'complete' | 'failed' | 'cancelled'

// Bunny VideoModelStatus: 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding,
// 4 Finished, 5 Error, 6 UploadFailed, 7 JitSegmenting, 8 JitPlaylistsCreated.
// Widget progress weighs the fetch/queue stage at 0-25% and transcoding at 20-100%.
export function phaseFor(bunnyStatus: number | null | undefined, encodeProgress: number | null | undefined): { phase: IngestPhase; progress: number } {
  const encode = Math.max(0, Math.min(100, Math.round(Number(encodeProgress) || 0)))
  if (bunnyStatus === 4) return { phase: 'complete', progress: 100 }
  if (bunnyStatus === 5 || bunnyStatus === 6) return { phase: 'failed', progress: encode > 0 ? 20 + Math.round(encode * 0.8) : 0 }
  if (bunnyStatus === 3 || bunnyStatus === 7 || bunnyStatus === 8) return { phase: 'transcoding', progress: 20 + Math.round(encode * 0.8) }
  if (bunnyStatus === 2) return { phase: 'fetching', progress: 25 }
  if (bunnyStatus === 1) return { phase: 'fetching', progress: 15 }
  if (bunnyStatus === 0) return { phase: 'fetching', progress: 5 }
  return { phase: 'fetching', progress: 0 }
}

/** Copyable Bunny iframe player snippet for a finished ingest. */
export function embedSnippet(libraryId: string, videoId: string): string {
  return `<iframe src="https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture" allowfullscreen="true"></iframe>`
}

// ---------- job lifecycle ----------

export type IngestDestination = 'sermon' | 'teaching' | 'show' | 'video'
export type IngestContentTable = 'entertainments' | 'episodes' | 'videos' | 'seasons'

export type IngestJob = {
  id: number
  dropbox_url: string
  fetch_url: string
  title: string
  destination: IngestDestination
  series_id: number | null
  season_id: number | null
  content_table: IngestContentTable | null
  content_id: number | null
  bunny_video_id: string | null
  phase: IngestPhase
  progress: number
  bunny_status: number | null
  thumbnail_url: string | null
  duration: number | null
  resolutions: string | null
  error: string | null
  created_at: string
}

/** Persistence port: production adapts D1 (media-ingest.server.ts), the gate adapts memory. */
export type IngestStore = {
  insertJob(job: Omit<IngestJob, 'id' | 'phase' | 'progress' | 'bunny_video_id' | 'bunny_status' | 'thumbnail_url' | 'duration' | 'resolutions' | 'error' | 'created_at'> & { created_at?: string }): Promise<number>
  updateJob(id: number, patch: Partial<IngestJob>): Promise<void>
  getJob(id: number): Promise<IngestJob | null>
  listJobs(): Promise<IngestJob[]>
  activeJobs(): Promise<IngestJob[]>
  claimedVideoIds(): Promise<string[]>
  insertContent(table: IngestContentTable, data: Record<string, unknown>): Promise<number>
  attachContentGuid(table: IngestContentTable, id: number, guid: string): Promise<void>
  softDeleteContent(table: IngestContentTable, id: number): Promise<void>
  /** Map genres/personalities (entertainments only) and locations onto a content row. */
  mapContent(table: IngestContentTable, id: number, maps: { genreIds?: number[]; castIds?: number[]; locationIds?: number[] }): Promise<void>
}

export type BunnyVideoStatus = {
  status: number
  encodeProgress: number
  length?: number
  thumbnailUrl?: string | null
  availableResolutions?: string | null
  transcodingMessages?: { level: number; message?: string | null }[] | null
}

/** Bunny Stream API surface used by the pipeline. */
export type BunnyClient = {
  fetchVideo(input: { url: string; title: string }): Promise<{ ok: boolean; error?: string }>
  listVideos(): Promise<{ guid: string; title: string; dateUploaded: string }[]>
  getVideo(guid: string): Promise<BunnyVideoStatus>
  deleteVideo(guid: string): Promise<void>
}

export type IngestInput = {
  url: unknown
  title: unknown
  destination: unknown
  seriesId?: unknown
  seasonId?: unknown
  newSeriesTitle?: unknown
  newSeasonTitle?: unknown
  /** Skip the Bunny fetch and attach an existing library video directly (bulk import). */
  bunnyVideoId?: unknown
  description?: unknown
  releaseDate?: unknown
  access?: unknown
  genreIds?: unknown
  castIds?: unknown
  locationIds?: unknown
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120) || 'video'
}

function destinationTable(destination: IngestDestination): IngestContentTable {
  if (destination === 'sermon') return 'entertainments'
  if (destination === 'video') return 'videos'
  return 'episodes'
}

function idList(value: unknown, label: string): number[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 20) throw new Error(`Choose up to 20 ${label}.`)
  const ids = value.map(Number)
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error(`Invalid ${label}.`)
  return [...new Set(ids)]
}

export async function createIngestJob(store: IngestStore, bunny: BunnyClient, input: IngestInput): Promise<IngestJob> {
  // A pre-supplied Bunny GUID attaches an already-uploaded video without a fetch.
  const directGuid = typeof input.bunnyVideoId === 'string' && input.bunnyVideoId.trim() ? input.bunnyVideoId.trim() : null
  const fetchUrl = directGuid ? null : normalizeDropboxUrl(input.url)
  if (!directGuid && !fetchUrl) throw new Error('Enter a valid Dropbox shared link.')
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title || title.length > 200) throw new Error('Enter a title of up to 200 characters.')
  const destination = String(input.destination) as IngestDestination
  if (!['sermon', 'teaching', 'show', 'video'].includes(destination)) throw new Error('Choose where this video belongs.')
  const genreIds = idList(input.genreIds, 'categories')
  const castIds = idList(input.castIds, 'personalities')
  const locationIds = idList(input.locationIds, 'locations')
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 5000) : ''
  const releaseDate = typeof input.releaseDate === 'string' ? input.releaseDate.trim().slice(0, 40) : ''
  const access = ['free', 'paid', 'subscription'].includes(String(input.access)) ? String(input.access) : 'free'
  const episodic = destination === 'teaching' || destination === 'show'
  const newSeriesTitle = typeof input.newSeriesTitle === 'string' ? input.newSeriesTitle.trim() : ''
  const newSeasonTitle = typeof input.newSeasonTitle === 'string' ? input.newSeasonTitle.trim() : ''
  let seriesId = input.seriesId == null || input.seriesId === '' ? null : Number(input.seriesId)
  let seasonId = input.seasonId == null || input.seasonId === '' ? null : Number(input.seasonId)
  if (episodic && !newSeriesTitle && (!Number.isFinite(seriesId) || !seriesId)) throw new Error('Choose a series for this video.')
  if (episodic && !newSeasonTitle && (!Number.isFinite(seasonId) || !seasonId)) throw new Error('Choose a season for this video.')

  if (!directGuid) {
    const fetched = await bunny.fetchVideo({ url: fetchUrl!, title })
    if (!fetched.ok) throw new Error(fetched.error || 'Bunny Stream rejected the fetch. Try again in a moment.')
  }

  const now = new Date().toISOString()
  if (episodic && newSeriesTitle) {
    seriesId = await store.insertContent('entertainments', {
      name: newSeriesTitle, type: destination === 'show' ? 'tvshow' : 'teaching',
      slug: slugify(newSeriesTitle), status: 1, created_at: now, updated_at: now,
    })
    await store.mapContent('entertainments', seriesId, { genreIds, castIds, locationIds })
    seasonId = null
  }
  if (episodic && (newSeasonTitle || newSeriesTitle)) {
    seasonId = await store.insertContent('seasons', {
      name: newSeasonTitle || 'Volume 1', entertainment_id: seriesId,
      status: 1, created_at: now, updated_at: now,
    })
  }

  const table = destinationTable(destination)
  const contentId = await store.insertContent(table, destination === 'sermon'
    ? { name: title, type: 'movie', slug: slugify(title), status: 1, description: description || null, release_date: releaseDate || null, movie_access: access, created_at: now, updated_at: now }
    : destination === 'video'
      ? { name: title, slug: slugify(title), status: 1, description: description || null, release_date: releaseDate || null, access, created_at: now, updated_at: now }
      : { name: title, entertainment_id: seriesId, season_id: seasonId, status: 1, description: description || null, release_date: releaseDate || null, access, created_at: now, updated_at: now })
  await store.mapContent(table, contentId, { genreIds, castIds, locationIds })

  const jobId = await store.insertJob({
    dropbox_url: directGuid ? '' : String(input.url).trim(),
    fetch_url: directGuid ? '' : fetchUrl!,
    title,
    destination,
    series_id: episodic ? seriesId : null,
    season_id: episodic ? seasonId : null,
    content_table: table,
    content_id: contentId,
    created_at: now,
  })
  if (directGuid) {
    await store.updateJob(jobId, { bunny_video_id: directGuid })
    await store.attachContentGuid(table, contentId, directGuid)
  }
  const job = await store.getJob(jobId)
  if (!job) throw new Error('The ingest could not be started. Please try again.')
  return job
}

/** Newest unclaimed library video matching the job title becomes this job's video. */
async function discoverVideoId(store: IngestStore, bunny: BunnyClient, job: IngestJob): Promise<string | null> {
  const [videos, claimed] = await Promise.all([bunny.listVideos(), store.claimedVideoIds()])
  const match = videos.find(video => video.title === job.title && !claimed.includes(video.guid))
  if (!match) return null
  await store.updateJob(job.id, { bunny_video_id: match.guid })
  if (job.content_table && job.content_id) await store.attachContentGuid(job.content_table, job.content_id, match.guid)
  return match.guid
}

function failureMessage(video: BunnyVideoStatus): string {
  const messages = video.transcodingMessages ?? []
  const worst = [...messages].sort((a, b) => b.level - a.level).find(entry => entry.message)
  return worst?.message ?? 'Bunny Stream could not process this video.'
}

/** Polls every active job one step: discovery, progress, completion, failure. */
export async function refreshIngestJobs(store: IngestStore, bunny: BunnyClient): Promise<IngestJob[]> {
  const jobs = await store.activeJobs()
  for (const job of jobs) {
    const guid = job.bunny_video_id ?? await discoverVideoId(store, bunny, job)
    if (!guid) continue
    const video = await bunny.getVideo(guid)
    const { phase, progress } = phaseFor(video.status, video.encodeProgress)
    await store.updateJob(job.id, {
      bunny_status: video.status,
      phase,
      progress,
      thumbnail_url: video.thumbnailUrl ?? job.thumbnail_url ?? null,
      duration: video.length ?? job.duration ?? null,
      resolutions: video.availableResolutions ?? job.resolutions ?? null,
      error: phase === 'failed' ? failureMessage(video) : null,
    })
  }
  return store.listJobs()
}

/** Cancel deletes the Bunny video (when discovered) and the content row. */
export async function cancelIngestJob(store: IngestStore, bunny: BunnyClient, id: number): Promise<void> {
  const job = await store.getJob(id)
  if (!job) throw new Error('Ingest job not found.')
  if (job.phase === 'complete') return
  if (job.bunny_video_id) await bunny.deleteVideo(job.bunny_video_id).catch(() => {})
  if (job.content_table && job.content_id) await store.softDeleteContent(job.content_table, job.content_id)
  await store.updateJob(job.id, { phase: 'cancelled', error: null })
}

/** Retry re-queues a failed ingest: the broken Bunny video is dropped and re-fetched. */
export async function retryIngestJob(store: IngestStore, bunny: BunnyClient, id: number): Promise<IngestJob> {
  const job = await store.getJob(id)
  if (!job) throw new Error('Ingest job not found.')
  if (job.phase !== 'failed') throw new Error('Only failed ingests can be retried.')
  if (job.bunny_video_id) await bunny.deleteVideo(job.bunny_video_id).catch(() => {})
  const fetched = await bunny.fetchVideo({ url: job.fetch_url, title: job.title })
  if (!fetched.ok) throw new Error(fetched.error || 'Bunny Stream rejected the fetch. Try again in a moment.')
  await store.updateJob(job.id, { phase: 'fetching', progress: 0, error: null, bunny_video_id: null, bunny_status: null })
  return (await store.getJob(job.id))!
}

export async function listIngestJobs(store: IngestStore): Promise<IngestJob[]> {
  return store.listJobs()
}
