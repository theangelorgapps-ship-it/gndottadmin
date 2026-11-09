// In-memory IngestStore adapter: the test double for the media ingest gate.
// Production uses the D1 SQL adapter in src/lib/media-ingest.server.ts; both
// implement the same port so the gate exercises real core logic without SQL.
export function createMemoryIngestStore() {
  let nextJobId = 1
  const contentIds = {}
  const jobs = []
  const content = { entertainments: [], episodes: [], videos: [], seasons: [] }
  const mappings = []
  return {
    jobs,
    content,
    mappings,
    async insertJob(job) {
      const row = { id: nextJobId++, phase: 'fetching', progress: 0, bunny_video_id: null, bunny_status: null, error: null, series_id: null, season_id: null, content_table: null, content_id: null, created_at: new Date().toISOString(), ...job }
      jobs.push(row)
      return row.id
    },
    async updateJob(id, patch) {
      const job = jobs.find(j => j.id === Number(id))
      if (!job) throw new Error('Job not found.')
      Object.assign(job, patch)
    },
    async getJob(id) {
      return jobs.find(j => j.id === Number(id)) ?? null
    },
    async listJobs() {
      return [...jobs].sort((a, b) => b.id - a.id)
    },
    async activeJobs() {
      return jobs.filter(j => j.phase === 'fetching' || j.phase === 'transcoding')
    },
    async claimedVideoIds() {
      return jobs.map(j => j.bunny_video_id).filter(Boolean)
    },
    async insertContent(table, data) {
      const id = contentIds[table] = (contentIds[table] ?? 0) + 1
      content[table].push({ id, deleted_at: null, ...data })
      return id
    },
    async attachContentGuid(table, id, guid) {
      const row = content[table]?.find(r => r.id === Number(id))
      if (!row) throw new Error('Content row not found.')
      row.bunny_video_url = guid
      row.video_upload_type = 'bunny'
    },
    async softDeleteContent(table, id) {
      const row = content[table]?.find(r => r.id === Number(id))
      if (row) row.deleted_at = new Date().toISOString()
    },
    async mapContent(table, id, maps) {
      mappings.push({ table, id: Number(id), genreIds: maps.genreIds ?? [], castIds: maps.castIds ?? [], locationIds: maps.locationIds ?? [] })
    },
  }
}

// Scripted Bunny client: the gate drives status transitions by advancing queue steps.
export function createScriptedBunny(script = {}) {
  const calls = { fetchVideo: [], deleteVideo: [], getVideo: 0, listVideos: 0 }
  const state = { videos: [], fetchFails: script.fetchFails ?? 0, nextGuid: 1 }
  return {
    calls,
    state,
    async fetchVideo({ url, title }) {
      calls.fetchVideo.push({ url, title })
      if (state.fetchFails > 0) {
        state.fetchFails -= 1
        return { ok: false, error: 'Bunny rejected the fetch (mock 429).' }
      }
      state.videos.push({ guid: `guid-${state.nextGuid++}`, title, dateUploaded: new Date().toISOString(), status: 0, encodeProgress: 0, ...(script.video ?? {}) })
      return { ok: true }
    },
    async listVideos() {
      calls.listVideos += 1
      return [...state.videos].sort((a, b) => b.dateUploaded.localeCompare(a.dateUploaded))
    },
    async getVideo(guid) {
      calls.getVideo += 1
      const video = state.videos.find(v => v.guid === guid)
      if (!video) throw new Error('Bunny 404 (mock)')
      return video
    },
    async deleteVideo(guid) {
      calls.deleteVideo.push(guid)
      state.videos = state.videos.filter(v => v.guid !== guid)
    },
  }
}

// In-memory TaxonomyStore: resolves names case-insensitively, creates when missing.
// Series and seasons are real content rows, so they go through the ingest store —
// exactly what the D1 adapter does in production.
export function createMemoryTax(store) {
  const data = { genre: [], preacher: [], location: [], series: [], season: [] }
  const ids = {}
  return {
    data,
    async resolve(kind, name, context = {}) {
      const key = kind === 'season' ? `${kind}:${name.toLowerCase()}@${context.seriesId}`
        : kind === 'series' ? `${kind}:${name.toLowerCase()}@${context.seriesType}`
        : `${kind}:${name.toLowerCase()}`
      if (ids[key] !== undefined) return { id: ids[key], created: false }
      let id
      if (kind === 'series') {
        id = await store.insertContent('entertainments', { name, type: context.seriesType, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), status: 1 })
        data.series.push({ id, name, ...context })
      } else if (kind === 'season') {
        id = await store.insertContent('seasons', { name, entertainment_id: context.seriesId, status: 1 })
        data.season.push({ id, name, ...context })
      } else {
        id = data[kind].length + 1
        data[kind].push({ id, name })
      }
      ids[key] = id
      return { id, created: true }
    },
    async contentNameExists(table, name) {
      return store.content[table].some(row => row.name.toLowerCase() === name.toLowerCase() && !row.deleted_at)
    },
  }
}
