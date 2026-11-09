import { liveUrl, liveEmbedUrl, resolveLiveSource } from './live-sources'
import { safeContentLink, sanitizeContentHtml, RICH_TEXT_FIELDS } from './rich-text'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import { getSession } from './session.server'
import { all, first, run } from './db'
import { groupedType, isSeriesEntity, assertGroupedRecord, validateGroupedValues } from './series-validation'
import { normalizeBunnyFields } from './bunny'
import { safeArtworkUrl } from './banner-design'
import { positiveId, validateLocation, validatePersonalitySocials, type LocationInput, type LocationAssignment } from './locations-validation'

const ADMIN_TYPES = ['admin', 'demo_admin']

// Locations have their own records and typed title associations. The legacy
// cast source IDs are immutable and excluded from every personality editor.
export const adminListLocations = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(`SELECT l.id, l.name, l.file_url, l.address, l.status,
    (SELECT COUNT(*) FROM content_location_mapping m WHERE m.location_id = l.id) AS titles
    FROM locations l WHERE l.deleted_at IS NULL ORDER BY l.name`)
})

export const adminLocationOptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const [entertainments, videos, episodes] = await Promise.all([
    all(`SELECT id, name, type, 'entertainment' AS content_type FROM entertainments WHERE deleted_at IS NULL ORDER BY name`),
    all(`SELECT id, name, 'video' AS type, 'video' AS content_type FROM videos WHERE deleted_at IS NULL ORDER BY name`),
    all(`SELECT ep.id, ep.name, 'episode' AS type, 'episode' AS content_type, e.name AS parent_name
      FROM episodes ep JOIN entertainments e ON e.id = ep.entertainment_id
      WHERE ep.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.name, ep.name`),
  ])
  return [...entertainments, ...videos, ...episodes]
})

export const adminGetLocation = createServerFn({ method: 'GET' })
  .validator(positiveId)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const row = await first<any>(`SELECT id, name, file_url, description, address, status FROM locations WHERE id = ? AND deleted_at IS NULL`, id)
    if (!row) throw new Error('Location not found.')
    const assignments = await all<LocationAssignment>(`SELECT content_type, content_id FROM content_location_mapping WHERE location_id = ?`, id)
    return { ...row, assignments } as LocationInput
  })

export const adminUpsertLocation = createServerFn({ method: 'POST' })
  .validator(validateLocation)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (data.id && !await first(`SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL`, data.id)) throw new Error('Location not found.')
    // Validate every association against a known table; never trust a client
    // supplied table name or allow an ID collision between video and sermon.
    for (const [kind, table] of Object.entries({ entertainment: 'entertainments', video: 'videos', episode: 'episodes' })) {
      const ids = data.assignments.filter(item => item.content_type === kind).map(item => item.content_id)
      for (let start = 0; start < ids.length; start += 80) {
        const chunk = ids.slice(start, start + 80)
        const found = await all(`SELECT id FROM ${table} WHERE deleted_at IS NULL AND id IN (${chunk.map(() => '?').join(',')})`, ...chunk)
        if (found.length !== chunk.length) throw new Error('A selected title is no longer available. Refresh the list and try again.')
      }
    }
    const db = (env as any).DB
    const values = [data.name, data.file_url ?? null, data.description ?? null, data.address ?? null, data.status]
    const statements = [data.id
      ? db.prepare(`UPDATE locations SET name = ?, file_url = ?, description = ?, address = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).bind(...values, data.id)
      : db.prepare(`INSERT INTO locations (name, file_url, description, address, status) VALUES (?, ?, ?, ?, ?)`).bind(...values)]
    if (data.id) statements.push(db.prepare(`DELETE FROM content_location_mapping WHERE location_id = ?`).bind(data.id))
    for (const assignment of data.assignments) {
      // sqlite_sequence is scoped to locations and stable throughout this
      // atomic D1 batch, including after mapping inserts change last_insert_rowid.
      statements.push(data.id
        ? db.prepare(`INSERT INTO content_location_mapping (location_id, content_type, content_id) VALUES (?, ?, ?)`).bind(data.id, assignment.content_type, assignment.content_id)
        : db.prepare(`INSERT INTO content_location_mapping (location_id, content_type, content_id) SELECT seq, ?, ? FROM sqlite_sequence WHERE name = 'locations'`).bind(assignment.content_type, assignment.content_id))
    }
    const results = await db.batch(statements)
    return { ok: true, id: data.id ?? results[0]?.meta?.last_row_id }
  })

export const adminDeleteLocation = createServerFn({ method: 'POST' })
  .validator(positiveId)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    if (!await first(`SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL`, id)) throw new Error('Location not found.')
    await run(`UPDATE locations SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

export class AdminError extends Error {
  code: 'needsAuth' | 'forbidden'
  constructor(code: 'needsAuth' | 'forbidden', message: string) {
    super(message)
    this.code = code
  }
}

export const requireAdmin = createServerOnlyFn(async (): Promise<{ uid: number; email: string }> => {
  const session = await getSession()
  if (!session) throw new AdminError('needsAuth', 'Sign in required.')
  const user = await first<any>(
    `SELECT id, email, user_type FROM users WHERE id = ? AND deleted_at IS NULL AND status = 1 AND COALESCE(is_banned, 0) = 0`,
    session.uid,
  )
  if (!user || !ADMIN_TYPES.includes(user.user_type)) {
    throw new AdminError('forbidden', 'Admin access required.')
  }
  if (user.user_type === 'demo_admin' && !['GET', 'HEAD'].includes(getRequest().method)) {
    throw new AdminError('forbidden', 'Demo administrators have read-only access.')
  }
  return { uid: user.id, email: user.email }
})

export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  const user = await first<any>(
    `SELECT id, email, first_name, last_name, user_type FROM users WHERE id = ? AND deleted_at IS NULL AND status = 1 AND COALESCE(is_banned, 0) = 0`,
    session.uid,
  )
  if (!user || !ADMIN_TYPES.includes(user.user_type)) return null
  return user
})

// ---------- dashboard ----------

export const getAdminStats = createServerFn({ method: 'GET' })
  .validator((d?: { from?: string; to?: string }) => d ?? {})
  .handler(async ({ data: range }) => {
    await requireAdmin()
    const from = range?.from && /^\d{4}-\d{2}-\d{2}$/.test(range.from) ? range.from : null
    const to = range?.to && /^\d{4}-\d{2}-\d{2}$/.test(range.to) ? range.to : null
    const dateClause = (col = 'created_at') =>
      `${from ? ` AND date(${col}) >= '${from}'` : ''}${to ? ` AND date(${col}) <= '${to}'` : ''}`
    const c = async (sql: string) =>
      (await first<{ n: number }>(sql).catch(() => ({ n: 0 })))?.n ?? 0
    const [movies, tvshows, teaching, videos, channels, users, genres, plans, activeSubs, cast, soonToExpire, rentContent] =
      await Promise.all([
        c(`SELECT COUNT(*) n FROM entertainments WHERE type='movie' AND deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM entertainments WHERE type='tvshow' AND deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM entertainments WHERE type='teaching' AND deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM videos WHERE deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM live_tv_channel WHERE deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM genres WHERE deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM plan WHERE deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM subscriptions WHERE status = 'active' AND deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM cast_crew WHERE deleted_at IS NULL${dateClause()}`),
        c(`SELECT COUNT(*) n FROM subscriptions WHERE status = 'active' AND deleted_at IS NULL AND end_date <= date('now', '+30 days')`),
        c(`SELECT COUNT(*) n FROM pay_per_views WHERE 1=1${dateClause()}`),
      ])
    const revenue = await first<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM subscriptions_transactions WHERE payment_status = 'paid'${dateClause()}`,
    ).catch(() => ({ total: 0 }))
    const rentRevenue = await first<{ total: number }>(
      `SELECT COALESCE(SUM(price), 0) AS total FROM pay_per_views WHERE 1=1${dateClause()}`,
    ).catch(() => ({ total: 0 }))
    const monthly = async (table: string, where = '', soft = true) =>
      all<{ m: string; n: number }>(
        `SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS n FROM ${table}
         WHERE created_at IS NOT NULL ${soft ? 'AND deleted_at IS NULL' : ''} ${where}${dateClause()} GROUP BY m ORDER BY m DESC LIMIT 6`,
      ).catch(() => [])
    const [usersM, moviesM, tvshowsM, teachingM, videosM, channelsM, genresM, plansM, subsM, castM, rentM] =
      await Promise.all([
        monthly('users'),
        monthly('entertainments', `AND type='movie'`),
        monthly('entertainments', `AND type='tvshow'`),
        monthly('entertainments', `AND type='teaching'`),
        monthly('videos'),
        monthly('live_tv_channel'),
        monthly('genres'),
        monthly('plan'),
        monthly('subscriptions'),
        monthly('cast_crew'),
        monthly('pay_per_views', '', false),
      ])
    const genreTop = await all(
      `SELECT g.name, COUNT(*) AS n FROM entertainment_gener_mapping m
       JOIN genres g ON g.id = m.genre_id AND g.deleted_at IS NULL
       GROUP BY g.id ORDER BY n DESC LIMIT 5`,
    ).catch(() => [])
    const recentUsers = await all(
      `SELECT id, first_name, last_name, email, user_type, created_at FROM users WHERE deleted_at IS NULL${dateClause()} ORDER BY id DESC LIMIT 6`,
    )
    const recentContent = await all(
      `SELECT id, name, type, release_date, status FROM entertainments WHERE deleted_at IS NULL${dateClause()} ORDER BY id DESC LIMIT 6`,
    )
    const recentTransactions = await all(
      `SELECT t.id, t.amount, t.payment_type, t.payment_status, t.created_at, u.email
       FROM subscriptions_transactions t LEFT JOIN users u ON u.id = t.user_id
       WHERE 1=1${dateClause('t.created_at')}
       ORDER BY t.id DESC LIMIT 6`,
    ).catch(() => [])
    return {
      counts: { movies, tvshows, teaching, videos, channels, users, genres, plans, activeSubs, cast, soonToExpire, rentContent },
      revenue: revenue?.total ?? 0,
      rentRevenue: rentRevenue?.total ?? 0,
      monthly: {
        users: usersM, movies: moviesM, tvshows: tvshowsM, teaching: teachingM, videos: videosM,
        channels: channelsM, genres: genresM, plans: plansM, activeSubs: subsM, cast: castM,
        rentContent: rentM, soonToExpire: subsM,
      },
      genreTop,
      recentUsers,
      recentContent,
      recentTransactions,
      range: { from, to },
    }
  })

// ---------- content CRUD ----------

export const adminListContent = createServerFn({ method: 'GET' })
  .validator((type: string) => type)
  .handler(async ({ data: type }) => {
    await requireAdmin()
    return all(
      `SELECT e.id, e.name, e.type, e.release_date, e.language, e.movie_access, e.content_rating, e.poster_url, e.thumbnail_url,
              e.IMDb_rating, e.duration, e.status, e.created_at, j.phase AS ingest_phase, j.progress AS ingest_progress,
              (SELECT COUNT(*) FROM entertainment_views v WHERE v.entertainment_id = e.id) AS views
       FROM entertainments e
       LEFT JOIN media_ingest_jobs j ON j.content_table = 'entertainments' AND j.content_id = e.id AND j.phase IN ('fetching', 'transcoding')
       WHERE e.type = ? AND e.deleted_at IS NULL ORDER BY e.id DESC`,
      type,
    )
  })

export interface ContentInput {
  id?: number
  name: string
  type: 'movie' | 'tvshow' | 'teaching'
  description?: string
  short_description?: string
  release_date?: string
  language?: string
  movie_access?: string
  content_rating?: string
  IMDb_rating?: string
  duration?: string
  status?: number
  poster_url?: string
  thumbnail_url?: string
  trailer_url?: string
  trailer_url_type?: string
  video_upload_type?: string
  video_url_input?: string
  bunny_video_url?: string
  bunny_trailer_url?: string
  enable_quality?: number
  enable_subtitle?: number
  subtitle_file?: string
  subtitle_language?: string
  is_default_subtitle?: number
  is_restricted?: number
  price?: number | null
  purchase_type?: string
  access_duration?: number | null
  discount?: number | null
  available_for?: string
  plan_id?: number | null
  meta_title?: string
  meta_keywords?: string
  meta_description?: string
  seo_image?: string
  genre_ids?: number[]
  cast_ids?: number[]
  director_ids?: number[]
  location_ids?: number[]
}

const CONTENT_WRITABLE = [
  'name', 'description', 'short_description', 'release_date', 'language', 'movie_access', 'content_rating',
  'IMDb_rating', 'duration', 'status', 'poster_url', 'thumbnail_url', 'trailer_url', 'trailer_url_type',
  'video_upload_type', 'video_url_input', 'bunny_video_url', 'bunny_trailer_url', 'enable_quality',
  'enable_subtitle', 'subtitle_file', 'subtitle_language', 'is_default_subtitle', 'is_restricted',
  'price', 'purchase_type', 'access_duration', 'discount', 'available_for', 'plan_id',
  'meta_title', 'meta_keywords', 'meta_description', 'seo_image',
] as const

export const adminGetContent = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const row = await first<any>(`SELECT * FROM entertainments WHERE id = ? AND deleted_at IS NULL`, id)
    if (!row) throw new Error('not found')
    const genres = await all<any>(`SELECT genre_id FROM entertainment_gener_mapping WHERE entertainment_id = ?`, id).catch(() => [])
    const cast = await all<any>(`SELECT m.talent_id, COALESCE(m.type, c.type) AS type FROM entertainment_talent_mapping m JOIN cast_crew c ON c.id = m.talent_id WHERE m.entertainment_id = ? AND m.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id)`, id).catch(() => [])
    const locations = await all<{ location_id: number }>(`SELECT m.location_id FROM content_location_mapping m JOIN locations l ON l.id=m.location_id WHERE m.content_type = 'entertainment' AND m.content_id = ? AND l.deleted_at IS NULL`, id)
    return {
      ...row,
      location_ids: locations.map(l => l.location_id),
      genre_ids: genres.map((g) => g.genre_id),
      cast_ids: cast.filter((c) => c.type !== 'director').map((c) => c.talent_id),
      director_ids: cast.filter((c) => c.type === 'director').map((c) => c.talent_id),
    }
  })

export const adminContentOptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const [genres, cast, plans, locations] = await Promise.all([
    all(`SELECT id, name FROM genres WHERE deleted_at IS NULL ORDER BY name`),
    all(`SELECT c.id, c.name, c.type FROM cast_crew c WHERE c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id) ORDER BY c.name LIMIT 500`),
    all(`SELECT id, name FROM plan WHERE deleted_at IS NULL ORDER BY CAST(level AS INTEGER)`).catch(() => []),
    all(`SELECT id, name FROM locations WHERE deleted_at IS NULL ORDER BY name`),
  ])
  return { genres, cast, plans, locations }
})

export const adminUpsertContent = createServerFn({ method: 'POST' })
  .validator((d: ContentInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    data = normalizeBunnyFields(data)
    if ('description' in data) data.description = sanitizeContentHtml(data.description)
    if (!data.name?.trim()) throw new Error('Name is required.')
    if (!['movie', 'tvshow', 'teaching'].includes(data.type)) throw new Error('Type must be movie, tvshow or teaching.')
    for (const supplied of [data.cast_ids, data.director_ids]) {
      if (supplied === undefined) continue
      if (!Array.isArray(supplied) || supplied.length > 500) throw new Error('Choose up to 500 personalities.')
      for (const tid of supplied) positiveId(tid)
      const ids = [...new Set(supplied)]
      for (let start = 0; start < ids.length; start += 80) {
        const chunk = ids.slice(start, start + 80)
        const found = await all(`SELECT c.id FROM cast_crew c WHERE c.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id)
          AND c.id IN (${chunk.map(() => '?').join(',')})`, ...chunk)
        if (found.length !== chunk.length) throw new Error('Choose existing personalities. Assign venues from Locations.')
      }
    }
    if (data.id) {
      positiveId(data.id)
      if (!await first(`SELECT id FROM entertainments WHERE id = ? AND type = ? AND deleted_at IS NULL`, data.id, data.type)) throw new Error('Title not found.')
    }
    if (data.location_ids !== undefined) {
      if (!Array.isArray(data.location_ids) || data.location_ids.length > 100) throw new Error('Choose up to 100 locations.')
      data.location_ids.forEach(positiveId)
      data.location_ids = [...new Set(data.location_ids)]
      for (let start = 0; start < data.location_ids.length; start += 80) {
        const chunk = data.location_ids.slice(start, start + 80)
        const found = await all(`SELECT id FROM locations WHERE deleted_at IS NULL AND id IN (${chunk.map(() => '?').join(',')})`, ...chunk)
        if (found.length !== chunk.length) throw new Error('Choose existing locations.')
      }
    }
    const vals: Record<string, any> = {}
    for (const f of CONTENT_WRITABLE) {
      if (f in data) {
        let v: any = (data as any)[f]
        if (typeof v === 'string') { v = v.trim(); if (v === '') v = null }
        vals[f] = v
      }
    }
    vals.name = data.name.trim()
    let id = data.id
    if (id) {
      const sets = Object.keys(vals).map((k) => `${k} = ?`).join(', ')
      await run(
        `UPDATE entertainments SET ${sets}, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`,
        ...Object.values(vals), admin.uid, id,
      )
    } else {
      vals.type = data.type
      vals.slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      vals.created_by = admin.uid
      vals.updated_by = admin.uid
      const cols = Object.keys(vals)
      const res = await run(
        `INSERT INTO entertainments (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`,
        ...Object.values(vals),
      )
      id = (res as any)?.meta?.last_row_id ?? null
    }
    if (id && (data.genre_ids || data.cast_ids || data.director_ids)) {
      if (data.genre_ids) {
        await run(`DELETE FROM entertainment_gener_mapping WHERE entertainment_id = ?`, id).catch(() => null)
        for (const gid of data.genre_ids)
          await run(`INSERT INTO entertainment_gener_mapping (entertainment_id, genre_id, created_at, updated_at) VALUES (?,?,datetime('now'),datetime('now'))`, id, gid).catch(() => null)
      }
      if (data.cast_ids || data.director_ids) {
        await run(`DELETE FROM entertainment_talent_mapping WHERE entertainment_id = ? AND talent_id NOT IN (SELECT source_cast_crew_id FROM locations WHERE source_cast_crew_id IS NOT NULL)`, id).catch(() => null)
        for (const tid of data.cast_ids ?? [])
          await run(`INSERT INTO entertainment_talent_mapping (entertainment_id, talent_id, type, created_at, updated_at) VALUES (?,?,'actor',datetime('now'),datetime('now'))`, id, tid).catch(() => null)
        for (const tid of data.director_ids ?? [])
          await run(`INSERT INTO entertainment_talent_mapping (entertainment_id, talent_id, type, created_at, updated_at) VALUES (?,?,'director',datetime('now'),datetime('now'))`, id, tid).catch(() => null)
      }
    }
    if (id && data.location_ids !== undefined) {
      const db = (env as any).DB
      await db.batch([
        db.prepare(`DELETE FROM content_location_mapping WHERE content_type = 'entertainment' AND content_id = ? AND location_id IN (SELECT id FROM locations WHERE deleted_at IS NULL)`).bind(id),
        ...data.location_ids.map(locationId => db.prepare(`INSERT INTO content_location_mapping (location_id, content_type, content_id) VALUES (?, 'entertainment', ?)`).bind(locationId, id)),
      ])
    }
    return { ok: true, id }
  })

export const adminDeleteContent = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    await run(`UPDATE entertainments SET deleted_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- videos CRUD ----------

export const adminListVideos = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(
    `SELECT v.id, v.name, v.release_date, v.duration, v.IMDb_rating, v.status, v.created_at, v.poster_url, v.thumbnail_url,
            j.phase AS ingest_phase, j.progress AS ingest_progress
     FROM videos v
     LEFT JOIN media_ingest_jobs j ON j.content_table = 'videos' AND j.content_id = v.id AND j.phase IN ('fetching', 'transcoding')
     WHERE v.deleted_at IS NULL ORDER BY v.id DESC`,
  )
})

export const adminUpsertVideo = createServerFn({ method: 'POST' })
  .validator((d: {
    id?: number; name: string; description?: string; duration?: string; release_date?: string; status?: number
    poster_url?: string; thumbnail_url?: string; trailer_url?: string; video_url_input?: string; video_upload_type?: string
    bunny_video_url?: string; access?: string; price?: number | null; enable_subtitle?: number; subtitle_file?: string
    subtitle_language?: string; meta_title?: string; meta_keywords?: string; meta_description?: string
  }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    data = normalizeBunnyFields(data)
    if ('description' in data) data.description = sanitizeContentHtml(data.description)
    if (!data.name?.trim()) throw new Error('Name is required.')
    const VCOLS = ['name', 'description', 'duration', 'release_date', 'status', 'poster_url', 'thumbnail_url',
      'trailer_url', 'video_url_input', 'video_upload_type', 'bunny_video_url', 'access', 'price',
      'enable_subtitle', 'subtitle_file', 'subtitle_language', 'meta_title', 'meta_keywords', 'meta_description'] as const
    const vals: Record<string, any> = {}
    for (const f of VCOLS) {
      if (f in data) {
        let v: any = (data as any)[f]
        if (typeof v === 'string') { v = v.trim(); if (v === '') v = null }
        vals[f] = v
      }
    }
    vals.name = data.name.trim()
    if (data.id) {
      const sets = Object.keys(vals).map((k) => `${k} = ?`).join(', ')
      await run(
        `UPDATE videos SET ${sets}, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`,
        ...Object.values(vals), admin.uid, data.id,
      )
      return { ok: true, id: data.id }
    }
    vals.slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    vals.created_by = admin.uid
    vals.updated_by = admin.uid
    const cols = Object.keys(vals)
    const res = await run(
      `INSERT INTO videos (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`,
      ...Object.values(vals),
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
  })

export const adminGetVideo = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const row = await first<any>(`SELECT * FROM videos WHERE id = ? AND deleted_at IS NULL`, id)
    if (!row) throw new Error('not found')
    return row
  })

export const adminDeleteVideo = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    await run(`UPDATE videos SET deleted_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- live TV ----------

export const adminListChannels = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const channels = await all(`SELECT c.id,c.name,c.category_id,c.access,c.description,c.status,c.poster_url,c.thumbnail_url,
    cat.name AS category,s.source_kind,s.hls_url,s.ingest_url,s.embed_url,
    COALESCE(s.comments_enabled,1) AS comments_enabled,COALESCE(s.slow_mode,5) AS slow_mode
    FROM live_tv_channel c LEFT JOIN live_tv_category cat ON cat.id=c.category_id
    LEFT JOIN live_channel_settings s ON s.channel_id=c.id
    WHERE c.deleted_at IS NULL ORDER BY c.id DESC`)
  const mappings = await all(`SELECT tv_channel_id,stream_type,server_url,server_url1 FROM live_tv_stream_content_mapping WHERE deleted_at IS NULL ORDER BY id DESC`)
  const categories = await all(`SELECT id,name,status FROM live_tv_category WHERE deleted_at IS NULL ORDER BY name`)
  return { channels: channels.map(c => ({ ...c, source_kind: c.source_kind || 'hls',
    hls_url: c.hls_url || (c.source_kind === 'embed' ? '' : resolveLiveSource(null,mappings.filter(m => m.tv_channel_id === c.id))) || '' })), categories }
})

type ChannelInput = { id?: number; name: string; category_id?: number; access: string; description: string; status: number;
  poster_url: string; thumbnail_url: string; source_kind: 'hls'|'rtmp'|'embed'; hls_url: string; ingest_url: string; embed_url: string;
  comments_enabled: boolean; slow_mode: number }
export const adminUpsertChannel = createServerFn({ method: 'POST' })
  .validator((data: ChannelInput) => {
    if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200) throw new Error('Enter a channel name of up to 200 characters.')
    if (data.id !== undefined) positiveId(data.id)
    if (data.category_id !== undefined) positiveId(data.category_id)
    if (!['free','paid'].includes(data.access) || ![0,1].includes(data.status) || !['hls','rtmp','embed'].includes(data.source_kind)) throw new Error('Choose valid access, status and stream options.')
    if (typeof data.comments_enabled !== 'boolean' || !Number.isInteger(data.slow_mode) || data.slow_mode < 0 || data.slow_mode > 120) throw new Error('Choose a comment delay from 0 to 120 seconds.')
    if (typeof data.description !== 'string' || data.description.length > 30000) throw new Error('Description is too long.')
    for (const key of ['hls_url','ingest_url','embed_url'] as const) if (typeof data[key] !== 'string') throw new Error('Enter valid stream addresses.')
    const hls = data.source_kind === 'embed' ? null : liveUrl(data.hls_url)
    const ingest = data.source_kind === 'rtmp' ? liveUrl(data.ingest_url,'rtmp') : null
    const embed = data.source_kind === 'embed' ? liveEmbedUrl(data.embed_url) : null
    if (data.source_kind === 'embed' && !embed) throw new Error('Use a Viewmedia channel, YouTube embed or Vimeo player HTTPS URL.')
    if (data.source_kind !== 'embed' && (data.hls_url.trim() || data.status === 1) && !hls) throw new Error('Add a public HTTPS HLS playback URL. Raw RTMP cannot play in browsers.')
    if (data.source_kind === 'rtmp' && (!ingest || !hls)) throw new Error('Add the service’s RTMP/RTMPS ingest address and HTTPS HLS playback output.')
    return { ...data, name: data.name.trim(), description: sanitizeContentHtml(data.description),
      poster_url: safeArtworkUrl(data.poster_url), thumbnail_url: safeArtworkUrl(data.thumbnail_url),
      hls_url: hls, ingest_url: ingest, embed_url: embed }
  })
  .handler(async ({ data }) => {
    const user = await requireAdmin()
    if (data.id && !await first('SELECT id FROM live_tv_channel WHERE id=? AND deleted_at IS NULL',data.id)) throw new Error('Channel not found.')
    if (data.category_id && !await first('SELECT id FROM live_tv_category WHERE id=? AND deleted_at IS NULL',data.category_id)) throw new Error('Category not found.')
    const db = (env as any).DB
    const values = [data.name,data.category_id ?? null,data.access,data.description,data.status,data.poster_url,data.thumbnail_url,user.uid]
    const channel = data.id
      ? db.prepare(`UPDATE live_tv_channel SET name=?,category_id=?,access=?,description=?,status=?,poster_url=?,thumbnail_url=?,updated_by=?,updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL RETURNING id`).bind(...values,data.id)
      : db.prepare(`INSERT INTO live_tv_channel(name,category_id,access,description,status,poster_url,thumbnail_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,datetime('now'),datetime('now')) RETURNING id`).bind(...values)
    // D1 batch is transactional; last_insert_rowid is scoped to this batch for new channels.
    const settings = db.prepare(`INSERT INTO live_channel_settings(channel_id,source_kind,hls_url,ingest_url,embed_url,comments_enabled,slow_mode,updated_by)
      VALUES(${data.id ? '?' : 'last_insert_rowid()'},?,?,?,?,?,?,?) ON CONFLICT(channel_id) DO UPDATE SET source_kind=excluded.source_kind,hls_url=excluded.hls_url,
      ingest_url=excluded.ingest_url,embed_url=excluded.embed_url,comments_enabled=excluded.comments_enabled,slow_mode=excluded.slow_mode,updated_by=excluded.updated_by,updated_at=datetime('now')`)
      .bind(...(data.id ? [data.id] : []),data.source_kind,data.hls_url,data.ingest_url,data.embed_url,data.comments_enabled?1:0,data.slow_mode,user.uid)
    const results = await db.batch([channel,settings])
    return { ok: true, id: data.id ?? results[0]?.results?.[0]?.id }
  })

export const adminDeleteChannel = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    await run(`UPDATE live_tv_channel SET deleted_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- genres ----------

export const adminListGenres = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(
    `SELECT g.id, g.name, g.slug, g.status, g.file_url,
            (SELECT COUNT(*) FROM entertainment_gener_mapping m WHERE m.genre_id = g.id) AS titles
     FROM genres g WHERE g.deleted_at IS NULL ORDER BY g.name`,
  )
})

export const adminUpsertGenre = createServerFn({ method: 'POST' })
  .validator((d: { id?: number; name: string; status?: number; file_url?: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (!data.name?.trim()) throw new Error('Name is required.')
    const image = data.file_url === undefined ? undefined : safeArtworkUrl(data.file_url)
    const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (data.id) {
      await run(
        `UPDATE genres SET name=?, slug=?, status=?, file_url=CASE WHEN ? THEN ? ELSE file_url END, updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL`,
        data.name.trim(), slug, data.status ?? 1, image !== undefined ? 1 : 0, image ?? null, data.id,
      )
      return { ok: true, id: data.id }
    }
    const res = await run(
      `INSERT INTO genres (name, slug, status, file_url, created_at, updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
      data.name.trim(), slug, data.status ?? 1, image ?? null,
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
  })

export const adminDeleteGenre = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    await run(`UPDATE genres SET deleted_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- users ----------

export const adminListUsers = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.mobile, u.user_type, u.status, u.is_banned,
            u.is_subscribe, u.created_at,
            (SELECT COUNT(*) FROM user_multi_profiles p WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS profiles
     FROM users u WHERE u.deleted_at IS NULL ORDER BY u.id DESC`,
  )
})

export const adminSetUserBanned = createServerFn({ method: 'POST' })
  .validator((d: { id: number; banned: boolean }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    if (data.id === admin.uid) throw new Error('You cannot ban your own account.')
    const target = await first<any>(`SELECT user_type FROM users WHERE id = ?`, data.id)
    if (target?.user_type === 'admin') throw new Error('Cannot ban an admin account.')
    await run(`UPDATE users SET is_banned = ? WHERE id = ?`, data.banned ? 1 : 0, data.id)
    return { ok: true }
  })

// ---------- plans ----------

export const adminListPlans = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(
    `SELECT id, name, identifier, price, discount, total_price, duration, duration_value,
            level, status, description,
            (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = plan.id AND s.status = 'active') AS subscribers
     FROM plan WHERE deleted_at IS NULL ORDER BY CAST(level AS INTEGER)`,
  )
})

export const adminUpsertPlan = createServerFn({ method: 'POST' })
  .validator((d: {
    id?: number; name: string; price: number; duration?: string
    duration_value?: number; level?: number; status?: number; description?: string
  }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    if (!data.name?.trim()) throw new Error('Name is required.')
    if (data.price == null || isNaN(Number(data.price)) || Number(data.price) < 0)
      throw new Error('Valid price is required.')
    const identifier = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
    if (data.id) {
      await run(
        `UPDATE plan SET name=?, price=?, total_price=?, duration=?, duration_value=?, level=?,
         status=?, description=?, updated_by=?, updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL`,
        data.name.trim(), Number(data.price), Number(data.price),
        data.duration ?? 'month', data.duration_value ?? 1, data.level ?? 1,
        data.status ?? 1, data.description ?? null, admin.uid, data.id,
      )
      return { ok: true, id: data.id }
    }
    const res = await run(
      `INSERT INTO plan (name, identifier, price, total_price, duration, duration_value, level, status, description, created_by, updated_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      data.name.trim(), identifier, Number(data.price), Number(data.price),
      data.duration ?? 'month', data.duration_value ?? 1, data.level ?? 1,
      data.status ?? 1, data.description ?? null, admin.uid, admin.uid,
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
  })

export const adminDeletePlan = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    await run(`UPDATE plan SET deleted_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- subscriptions ----------

export const adminListSubscriptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const subscriptions = await all(
    `SELECT s.id, s.name AS plan_name, s.amount, s.total_amount, s.start_date, s.end_date,
            s.status, s.plan_type, u.email AS user_email
     FROM subscriptions s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.deleted_at IS NULL ORDER BY s.id DESC`,
  )
  const transactions = await all(
    `SELECT t.id, t.amount, t.payment_type, t.payment_status, t.transaction_id, t.created_at,
            u.email AS user_email
     FROM subscriptions_transactions t LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.id DESC LIMIT 50`,
  ).catch(() => [])
  return { subscriptions, transactions }
})

// ---------- settings ----------

export const adminGetSettings = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const rows = await all(
    `SELECT id, name, val, type FROM settings ORDER BY type, name`,
  )
  const groups: Record<string, any[]> = {}
  for (const r of rows as any[]) {
    const t = r.type || 'misc'
    ;(groups[t] ??= []).push(r)
  }
  return groups
})

export const adminSaveSetting = createServerFn({ method: 'POST' })
  .validator((d: { id: number; val: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    await run(`UPDATE settings SET val = ?, updated_at = datetime('now') WHERE id = ?`, String(data.val), data.id)
    return { ok: true }
  })

export const adminUpsertSetting = createServerFn({ method: 'POST' })
  .validator((d: { type: string; name: string; val: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    const existing = await first<any>(`SELECT id FROM settings WHERE type = ? AND name = ? AND deleted_at IS NULL`, data.type, data.name)
    if (existing) {
      await run(`UPDATE settings SET val = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, String(data.val), admin.uid, existing.id)
    } else {
      await run(
        `INSERT INTO settings (name, val, type, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        data.name, String(data.val), data.type, admin.uid, admin.uid,
      )
    }
    return { ok: true }
  })

export const adminListCurrencies = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(`SELECT id, currency_name, currency_code, currency_symbol, is_primary FROM currencies WHERE deleted_at IS NULL ORDER BY id`)
})

export const adminTestNovu = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAdmin()
  const rows = await all<any>(
    `SELECT name, val FROM settings WHERE name IN ('novu_api_key', 'novu_application_id', 'novu_backend_url') AND deleted_at IS NULL`,
  )
  const cfg = Object.fromEntries(rows.map((r) => [r.name, r.val ?? '']))
  const key = cfg.novu_api_key?.trim()
  if (!key) throw new Error('Set the Novu Secret Key first, save, then test.')
  const base = (cfg.novu_backend_url?.trim() || 'https://api.novu.co').replace(/\/$/, '')
  const res = await fetch(`${base}/v2/workflows?limit=1`, {
    headers: { Authorization: `ApiKey ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Novu responded ${res.status}: ${body.slice(0, 140) || res.statusText}`)
  }
  const json: any = await res.json().catch(() => null)
  const count = typeof json?.totalCount === 'number' ? json.totalCount : undefined
  return { ok: true, workflows: count }
})

// ---------- generic read-only admin tables (Batch F) ----------

const ADMIN_TABLES: Record<string, string> = {
  'media-library': `SELECT id, name, file_name, mime_type, size, created_at FROM media ORDER BY id DESC LIMIT 200`,
  seasons: `SELECT s.id, s.name, s.poster_url, s.status, e.name AS show FROM seasons s LEFT JOIN entertainments e ON e.id = s.entertainment_id WHERE s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 300`,
  series: `SELECT s.id, s.name, s.season_number, s.poster_url, s.status, e.name AS show FROM seasons s JOIN entertainments e ON e.id = s.entertainment_id WHERE e.type = 'tvshow' AND e.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY e.name, COALESCE(s.season_number, CAST(s.season_index AS INTEGER)), s.id`,
  'teaching-volumes': `SELECT s.id, s.name, s.season_number, s.poster_url, s.status, e.name AS show FROM seasons s JOIN entertainments e ON e.id = s.entertainment_id WHERE e.type = 'teaching' AND e.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY e.name, COALESCE(s.season_number, CAST(s.season_index AS INTEGER)), s.id`,
  episodes: `SELECT ep.id, ep.name, ep.poster_url, ep.status, ep.duration, e.name AS show, s.name AS season, j.phase AS ingest_phase, j.progress AS ingest_progress FROM episodes ep LEFT JOIN entertainments e ON e.id = ep.entertainment_id AND e.type = 'tvshow' LEFT JOIN seasons s ON s.id = ep.season_id LEFT JOIN media_ingest_jobs j ON j.content_table = 'episodes' AND j.content_id = ep.id AND j.phase IN ('fetching', 'transcoding') WHERE ep.deleted_at IS NULL AND e.deleted_at IS NULL AND e.id IS NOT NULL ORDER BY ep.id DESC LIMIT 300`,
  'teaching-episodes': `SELECT ep.id, ep.name, ep.poster_url, ep.status, ep.duration, e.name AS show, s.name AS season, j.phase AS ingest_phase, j.progress AS ingest_progress FROM episodes ep LEFT JOIN entertainments e ON e.id = ep.entertainment_id AND e.type = 'teaching' LEFT JOIN seasons s ON s.id = ep.season_id LEFT JOIN media_ingest_jobs j ON j.content_table = 'episodes' AND j.content_id = ep.id AND j.phase IN ('fetching', 'transcoding') WHERE ep.deleted_at IS NULL AND e.deleted_at IS NULL AND e.id IS NOT NULL ORDER BY ep.id DESC LIMIT 300`,
  'tv-category': `SELECT id, name, file_url, status FROM live_tv_category WHERE deleted_at IS NULL ORDER BY name`,
  actors: `SELECT c.id, c.name, c.file_url, c.designation, c.status FROM cast_crew c WHERE c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id) ORDER BY c.id LIMIT 500`,
  directors: `SELECT c.id, c.name, c.file_url, c.designation, c.status FROM cast_crew c WHERE c.type = 'director' AND c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id) ORDER BY c.id LIMIT 500`,
  'vast-ads': `SELECT * FROM vast_ads_setting WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 100`,
  'custom-ads': `SELECT * FROM custom_ads_setting WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 100`,
  'plan-limits': `SELECT l.id, l.title, l.slug, l.status, (SELECT COUNT(*) FROM planlimitation_mapping m WHERE m.planlimitation_id = l.id) AS mappings FROM planlimitation l WHERE l.deleted_at IS NULL ORDER BY l.id`,
  'rent-history': `SELECT p.id, p.type, p.price, p.view_expiry_date, p.created_at, u.email AS user_email,
                    COALESCE(e.name, v.name, ep.name) AS title
             FROM pay_per_views p LEFT JOIN users u ON u.id = p.user_id
             LEFT JOIN entertainments e ON p.type IN ('movie','tvshow') AND e.id = p.movie_id
             LEFT JOIN videos v ON p.type = 'video' AND v.id = p.movie_id
             LEFT JOIN episodes ep ON p.type = 'episode' AND ep.id = p.movie_id
             ORDER BY p.id DESC LIMIT 200`,
  coupons: `SELECT id, code, discount_type, discount, start_date, expire_date, status FROM coupons WHERE deleted_at IS NULL ORDER BY id`,
  'soon-to-expire': `SELECT s.id, s.name, s.end_date, s.amount, u.email AS user_email FROM subscriptions s LEFT JOIN users u ON u.id = s.user_id
             WHERE s.deleted_at IS NULL AND s.status = 'active' AND s.end_date <= date('now', '+30 days') ORDER BY s.end_date LIMIT 200`,
  reviews: `SELECT r.id, r.rating, r.review, r.created_at, e.name AS content,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), u.email) AS author
            FROM reviews r LEFT JOIN entertainments e ON e.id = r.entertainment_id LEFT JOIN users u ON u.id = r.user_id
            WHERE r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 200`,
  banners: `SELECT id, title, file_url, type, banner_for, status FROM banners WHERE deleted_at IS NULL ORDER BY id`,
  constants: `SELECT id, name, type, value, status FROM constants WHERE deleted_at IS NULL ORDER BY sequence, id LIMIT 300`,
  'notification-templates': `SELECT id, name, label, type, status FROM notification_templates WHERE deleted_at IS NULL ORDER BY id`,
  pages: `SELECT id, name, slug, status FROM pages WHERE deleted_at IS NULL ORDER BY sequence, id`,
  onboarding: `SELECT id, title, file_url, status FROM onboardings WHERE deleted_at IS NULL ORDER BY id`,
  tax: `SELECT id, title, type, value, status FROM taxes WHERE deleted_at IS NULL ORDER BY id`,
  languages: `SELECT id, key, value, language, file FROM languages WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 300`,
  worlds: `SELECT id, name, state_id, status FROM worlds WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 300`,
  currencies: `SELECT id, currency_name, currency_symbol, currency_code, is_primary FROM currencies WHERE deleted_at IS NULL ORDER BY id`,
  countries: `SELECT id, code, name, dial_code, currency_code, status FROM countries WHERE deleted_at IS NULL ORDER BY name LIMIT 300`,
  faq: `SELECT id, question, status FROM faqs WHERE deleted_at IS NULL ORDER BY id`,
  'access-control': `SELECT r.id, r.name, r.title, r.is_fixed,
            (SELECT COUNT(*) FROM model_has_roles m WHERE m.role_id = r.id) AS users,
            (SELECT COUNT(*) FROM role_has_permissions p WHERE p.role_id = r.id) AS permissions
            FROM roles r ORDER BY r.id`,
}

export const adminTable = createServerFn({ method: 'GET' })
  .validator((key: string) => key)
  .handler(async ({ data: key }) => {
    const admin = await getAdminSession()
    if (!admin) throw new Error('unauthorized')
    const sql = ADMIN_TABLES[key]
    if (!sql) throw new Error(`unknown admin table: ${key}`)
    return groupedType(key) ? all(sql) : all(sql).catch(() => [])
  })

// ---------- generic CRUD (feature-replication of Laravel add/edit/delete) ----------

const SERIES_FIELDS = ['name', 'entertainment_id', 'season_number', 'season_index', 'poster_url', 'access', 'price', 'short_desc', 'description', 'status']
const CRUD_ENTITIES: Record<string, { table: string; fields: string[]; fixed?: Record<string, any> }> = {
  seasons: { table: 'seasons', fields: SERIES_FIELDS },
  series: { table: 'seasons', fields: SERIES_FIELDS },
  'teaching-volumes': { table: 'seasons', fields: SERIES_FIELDS },
  episodes: { table: 'episodes', fields: ['name', 'entertainment_id', 'season_id', 'episode_number', 'duration', 'release_date', 'poster_url', 'video_url_input', 'video_upload_type', 'bunny_video_url', 'access', 'price', 'short_desc', 'description', 'enable_subtitle', 'subtitle_file', 'subtitle_language', 'meta_title', 'meta_keywords', 'meta_description', 'status'] },
  actors: { table: 'cast_crew', fields: ['name', 'designation', 'file_url', 'dob', 'place_of_birth', 'bio', 'status', 'social_facebook', 'social_instagram', 'social_x', 'social_website'], fixed: { type: 'actor' } },
  directors: { table: 'cast_crew', fields: ['name', 'designation', 'file_url', 'dob', 'place_of_birth', 'bio', 'status', 'social_facebook', 'social_instagram', 'social_x', 'social_website'], fixed: { type: 'director' } },
  coupons: { table: 'coupons', fields: ['code', 'description', 'discount_type', 'discount', 'start_date', 'expire_date', 'status'] },
  banners: { table: 'banners', fields: ['title', 'type', 'type_id', 'banner_for', 'file_url', 'poster_url', 'status'] },
  faq: { table: 'faqs', fields: ['question', 'answer', 'status'] },
  tax: { table: 'taxes', fields: ['title', 'type', 'value', 'status'] },
  pages: { table: 'pages', fields: ['name', 'slug', 'description', 'status'] },
  onboarding: { table: 'onboardings', fields: ['title', 'description', 'file_url', 'status'] },
  'plan-limits': { table: 'planlimitation', fields: ['title', 'slug', 'description', 'status'] },
  'vast-ads': { table: 'vast_ads_setting', fields: ['name', 'type', 'url', 'duration', 'target_type', 'target_selection', 'enable_skip', 'skip_after', 'frequency', 'start_date', 'end_date', 'is_enable', 'status'] },
  'custom-ads': { table: 'custom_ads_setting', fields: ['name', 'type', 'url_type', 'placement', 'media', 'redirect_url', 'duration', 'skip_enabled', 'skip_after', 'start_date', 'end_date', 'is_enable', 'status'] },
  languages: { table: 'languages', fields: ['key', 'value', 'language', 'file'] },
  worlds: { table: 'worlds', fields: ['name', 'state_id', 'status'] },
  currencies: { table: 'currencies', fields: ['currency_name', 'currency_symbol', 'currency_code', 'is_primary', 'currency_position', 'no_of_decimal', 'thousand_separator', 'decimal_separator'] },
  countries: { table: 'countries', fields: ['code', 'name', 'dial_code', 'currency_name', 'symbol', 'currency_code', 'status'] },
  'tv-category': { table: 'live_tv_category', fields: ['name', 'file_url', 'description', 'status'] },
  'notification-templates': { table: 'notification_templates', fields: ['name', 'label', 'type', 'description', 'status'] },
  reviews: { table: 'reviews', fields: [] },
}
CRUD_ENTITIES['teaching-episodes'] = CRUD_ENTITIES.episodes

function entityFor(key: string) {
  const e = CRUD_ENTITIES[key]
  if (!e) throw new Error(`unknown entity: ${key}`)
  return e
}

export const adminOptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const [shows, teaching, seasons, contents] = await Promise.all([
    all(`SELECT id, name FROM entertainments WHERE type='tvshow' AND deleted_at IS NULL ORDER BY name LIMIT 500`),
    all(`SELECT id, name FROM entertainments WHERE type='teaching' AND deleted_at IS NULL ORDER BY name LIMIT 500`),
    all(`SELECT s.id, s.name, s.entertainment_id, e.type, s.season_number FROM seasons s JOIN entertainments e ON e.id=s.entertainment_id WHERE s.deleted_at IS NULL AND e.deleted_at IS NULL AND e.type IN ('tvshow','teaching') ORDER BY COALESCE(s.season_number, CAST(s.season_index AS INTEGER)), s.id`),
    all(`SELECT id, name, type FROM entertainments WHERE deleted_at IS NULL UNION ALL SELECT id, name, 'video' AS type FROM videos WHERE deleted_at IS NULL ORDER BY name`),
  ])
  return { shows, teaching, seasons, contents }
})

async function assertPersonalityRecord(entity: string, id?: number) {
  if (!['actors', 'directors'].includes(entity) || id === undefined) return
  positiveId(id)
  const person = await first<any>(`SELECT c.id, c.type FROM cast_crew c WHERE c.id = ? AND c.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id)`, id)
  if (!person || (entity === 'directors' && person.type !== 'director')) throw new Error('Personality not found.')
}

async function savePersonalitySocials(id: number, links: ReturnType<typeof validatePersonalitySocials>) {
  if (!links.length) return
  const db = (env as any).DB
  await db.batch(links.map(link => link.url
    ? db.prepare(`INSERT INTO personality_social_links (personality_id, provider, url) VALUES (?, ?, ?) ON CONFLICT(personality_id, provider) DO UPDATE SET url = excluded.url`).bind(id, link.provider, link.url)
    : db.prepare(`DELETE FROM personality_social_links WHERE personality_id = ? AND provider = ?`).bind(id, link.provider)))
}

export const adminGetRow = createServerFn({ method: 'GET' })
  .validator((d: { entity: string; id: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    const e = entityFor(data.entity)
    await assertPersonalityRecord(data.entity, data.id)
    const row = await first<any>(`SELECT * FROM ${e.table} WHERE id = ?`, data.id)
    if (!row) throw new Error('not found')
    await assertGroupedRecord(data.entity, row, first)
    const out: Record<string, any> = { id: row.id }
    for (const f of e.fields) out[f] = row[f]
    if (e.table === 'cast_crew') {
      const links = await all<any>(`SELECT provider, url FROM personality_social_links WHERE personality_id = ?`, data.id)
      for (const link of links) out[`social_${link.provider}`] = link.url
    }
    return out
  })

export const adminUpsertRow = createServerFn({ method: 'POST' })
  .validator((d: { entity: string; id?: number; values: Record<string, any> }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    const e = entityFor(data.entity)
    await assertPersonalityRecord(data.entity, data.id)
    const socials = e.table === 'cast_crew' ? validatePersonalitySocials(data.values) : []
    if (e.table === 'cast_crew' && 'name' in data.values && (typeof data.values.name !== 'string' || !data.values.name.trim())) throw new Error('Name is required.')
    if (e.table === 'episodes') data.values = normalizeBunnyFields(data.values)
    const current = data.id && groupedType(data.entity) ? await first<any>(`SELECT * FROM ${e.table} WHERE id = ?`, data.id) : null
    if (data.id && groupedType(data.entity)) await assertGroupedRecord(data.entity, current, first)
    const vals: Record<string, any> = {}
    for (const f of e.fields) {
      if (f.startsWith('social_')) continue
      if (f in data.values) {
        let v = data.values[f]
        if (data.entity === 'custom-ads' && f === 'redirect_url') v = safeContentLink(v)
        if (RICH_TEXT_FIELDS[data.entity]?.includes(f)) v = sanitizeContentHtml(v)
        if (typeof v === 'string') v = v.trim()
        if (v === '') v = null
        vals[f] = v
      }
    }
    if (Object.keys(vals).length === 0 && !data.id) throw new Error('nothing to save')
    await validateGroupedValues(data.entity, vals, current, first)
    if (data.id) {
      const sets = Object.keys(vals).map((k) => `${k} = ?`).join(', ')
      if (sets) await run(`UPDATE ${e.table} SET ${sets}, updated_at = datetime('now') WHERE id = ?`, ...Object.values(vals), data.id)
      await savePersonalitySocials(data.id, socials)
      return { ok: true, id: data.id }
    }
    const merged = { ...(e.fixed ?? {}), ...vals }
    const cols = Object.keys(merged)
    const res = await run(
      `INSERT INTO ${e.table} (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`,
      ...Object.values(merged),
    )
    const id = (res as any)?.meta?.last_row_id ?? null
    if (id) await savePersonalitySocials(id, socials)
    return { ok: true, id }
  })

export const adminDeleteRow = createServerFn({ method: 'POST' })
  .validator((d: { entity: string; id: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    const e = entityFor(data.entity)
    await assertPersonalityRecord(data.entity, data.id)
    if (groupedType(data.entity)) {
      const row = await first<any>(`SELECT * FROM ${e.table} WHERE id = ?`, data.id)
      await assertGroupedRecord(data.entity, row, first)
      if (isSeriesEntity(data.entity) && await first('SELECT id FROM episodes WHERE season_id = ? AND deleted_at IS NULL LIMIT 1', data.id)) {
        throw new Error('Reassign or remove the episodes before deleting this series or volume.')
      }
    }
    await run(`UPDATE ${e.table} SET deleted_at = datetime('now') WHERE id = ?`, data.id)
    return { ok: true }
  })

// reviews: delete-only moderation
export const adminDeleteReview = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    await run(`UPDATE reviews SET deleted_at = datetime('now') WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- user detail ----------

export const adminUserDetail = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const user = await first<any>(
      `SELECT id, username, first_name, last_name, email, mobile, login_type, file_url, gender, date_of_birth,
              is_banned, is_subscribe, status, user_type, created_at
       FROM users WHERE id = ?`,
      id,
    )
    if (!user) throw new Error('User not found')
    const subscription = await first<any>(
      `SELECT s.id, s.name, s.status, s.start_date, s.end_date, s.total_amount, s.duration, p.name AS plan_name
       FROM subscriptions s LEFT JOIN plan p ON p.id = s.plan_id
       WHERE s.user_id = ? AND s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 1`,
      id,
    )
    const reviews = await all(
      `SELECT r.id, r.rating, r.review, r.created_at, e.name AS content
       FROM reviews r LEFT JOIN entertainments e ON e.id = r.entertainment_id
       WHERE r.user_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10`,
      id,
    )
    const watchlistCount = await first<any>(`SELECT COUNT(*) AS c FROM watchlists WHERE user_id = ? AND deleted_at IS NULL`, id)
    const rents = await all(
      `SELECT p.id, p.type, p.price, p.view_expiry_date, p.created_at,
              COALESCE(e.name, v.name, ep.name) AS title
       FROM pay_per_views p
       LEFT JOIN entertainments e ON p.type IN ('movie','tvshow') AND e.id = p.movie_id
       LEFT JOIN videos v ON p.type = 'video' AND v.id = p.movie_id
       LEFT JOIN episodes ep ON p.type = 'episode' AND ep.id = p.movie_id
       WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 10`,
      id,
    )
    const profiles = await all(`SELECT id, name, avatar, is_child_profile FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL`, id)
    return { user, subscription, reviews, watchlistCount: watchlistCount?.c ?? 0, rents, profiles }
  })

// ---------- R2 media library ----------

export const adminListR2Media = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const bucket = (env as any).MEDIA
  if (!bucket?.list) return { ok: false as const, error: 'R2 bucket not bound.', objects: [] }
  const listed = await bucket.list({ limit: 200 })
  const objects = (listed.objects ?? []).filter((o: any) => !String(o.key).startsWith('private/')).map((o: any) => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : null,
    etag: o.etag,
    url: `/media/${o.key}`,
  }))
  return { ok: true as const, objects, truncated: listed.truncated ?? false }
})

export const adminDeleteR2Object = createServerFn({ method: 'POST' })
  .validator((key: string) => key)
  .handler(async ({ data: key }) => {
    await requireAdmin()
    void key
    throw new Error('Use the Media Library to delete files safely.')
  })

// ---------- roles & permissions ----------

export const adminListPermissions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(`SELECT id, name, is_fixed FROM permissions ORDER BY name`)
})

export const adminGetRole = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const role = await first<any>(`SELECT id, name, title, is_fixed FROM roles WHERE id = ?`, id)
    if (!role) throw new Error('Role not found')
    const perms = await all<any>(`SELECT permission_id FROM role_has_permissions WHERE role_id = ?`, id).catch(() => [])
    return { ...role, permission_ids: perms.map((p) => p.permission_id) }
  })

export const adminUpsertRole = createServerFn({ method: 'POST' })
  .validator((d: { id?: number; name: string; title?: string; permission_ids?: number[] }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (!data.name?.trim()) throw new Error('Role name is required.')
    const name = data.name.trim().toLowerCase().replace(/\s+/g, '_')
    let id = data.id
    if (id) {
      const role = await first<any>(`SELECT is_fixed FROM roles WHERE id = ?`, id)
      await run(`UPDATE roles SET name = ?, title = ?, updated_at = datetime('now') WHERE id = ?`, name, data.title ?? name, id)
      void role
    } else {
      const res = await run(
        `INSERT INTO roles (name, title, guard_name, is_fixed, created_at, updated_at) VALUES (?,?,?,0,datetime('now'),datetime('now'))`,
        name, data.title ?? data.name.trim(), 'admin',
      )
      id = (res as any)?.meta?.last_row_id
    }
    if (data.permission_ids && id) {
      await run(`DELETE FROM role_has_permissions WHERE role_id = ?`, id).catch(() => null)
      for (const pid of data.permission_ids)
        await run(`INSERT OR IGNORE INTO role_has_permissions (permission_id, role_id) VALUES (?,?)`, pid, id).catch(() => null)
    }
    return { ok: true, id }
  })

export const adminDeleteRole = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const role = await first<any>(`SELECT is_fixed, name FROM roles WHERE id = ?`, id)
    if (!role) throw new Error('Role not found')
    if (role.is_fixed) throw new Error('This is a fixed system role and cannot be deleted.')
    await run(`DELETE FROM role_has_permissions WHERE role_id = ?`, id).catch(() => null)
    await run(`DELETE FROM model_has_roles WHERE role_id = ?`, id).catch(() => null)
    await run(`DELETE FROM roles WHERE id = ?`, id)
    return { ok: true }
  })

// ---------- bunny stream config ----------

export const adminBunnyStatus = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const rows = await all(`SELECT name, val FROM settings WHERE name IN ('bunny_library_id', 'bunny_api_key')`)
  const map: Record<string, string> = {}
  for (const r of rows as any[]) map[r.name] = r.val ?? ''
  return {
    libraryId: map.bunny_library_id || null,
    hasApiKey: !!map.bunny_api_key,
    embedBase: map.bunny_library_id ? `https://iframe.mediadelivery.net/embed/${map.bunny_library_id}` : null,
  }
})

export const adminBunnyListVideos = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const rows = await all(`SELECT name, val FROM settings WHERE name IN ('bunny_library_id', 'bunny_api_key')`)
  const map: Record<string, string> = {}
  for (const r of rows as any[]) map[r.name] = r.val ?? ''
  if (!map.bunny_library_id || !map.bunny_api_key)
    return { ok: false as const, error: 'Bunny Stream is not configured. Set the Library ID and API Key in Settings → Bunny Stream.', videos: [] }
  const resp = await fetch(`https://video.bunnycdn.com/library/${map.bunny_library_id}/videos?page=1&itemsPerPage=50&orderBy=date`, {
    headers: { AccessKey: map.bunny_api_key, accept: 'application/json' },
  })
  if (!resp.ok) return { ok: false as const, error: `Bunny API error ${resp.status}: ${await resp.text().then((t) => t.slice(0, 200))}`, videos: [] }
  const json: any = await resp.json()
  const videos = (json.items ?? []).map((v: any) => ({
    id: v.guid, title: v.title, duration: v.length, status: v.status,
    thumbnail: v.thumbnailFileName ? `https://${map.bunny_library_id}.b-cdn.net/${v.guid}/${v.thumbnailFileName}` : null,
    dateUploaded: v.dateUploaded,
  }))
  return { ok: true as const, videos, totalItems: json.totalItems ?? videos.length }
})

// Responsive hero authoring: a versioned device contract shared with the public API.
export const adminHeroContentOptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(`SELECT id, name, type, poster_url, thumbnail_url, status FROM entertainments WHERE deleted_at IS NULL AND type IN ('movie','tvshow','teaching')
    UNION ALL SELECT id, name, 'video' AS type, poster_url, thumbnail_url, status FROM videos WHERE deleted_at IS NULL ORDER BY name`)
})
export const adminHeroBanners = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return all(`SELECT b.*, d.design_json, COALESCE(o.sort_order,b.id) AS sort_order,
      COALESCE(e.poster_url,v.poster_url) AS title_poster_url, COALESCE(e.thumbnail_url,v.thumbnail_url) AS title_thumbnail_url,
      COALESCE(e.name,v.name) AS title_name, COALESCE(e.status,v.status,0) AS title_status
    FROM banners b LEFT JOIN banner_designs d ON d.banner_id = b.id LEFT JOIN banner_order o ON o.banner_id=b.id
    LEFT JOIN entertainments e ON b.type!='video' AND e.id=b.type_id AND e.type=b.type AND e.deleted_at IS NULL
    LEFT JOIN videos v ON b.type='video' AND v.id=b.type_id AND v.deleted_at IS NULL
    WHERE b.deleted_at IS NULL ORDER BY b.banner_for, COALESCE(o.sort_order,b.id), b.id`)
})
export const adminReorderHeroBanners = createServerFn({ method: 'POST' })
  .validator((input: { placement: string; ids: number[] }) => input)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (!['home', 'movie', 'tv_show', 'teaching', 'video'].includes(data.placement)) throw new Error('Choose a valid placement.')
    if (!Array.isArray(data.ids) || data.ids.length === 0 || data.ids.length > 2000 || new Set(data.ids).size !== data.ids.length) throw new Error('Choose a complete banner order.')
    data.ids.forEach(positiveId)
    const current = await all<{ id: number }>(`SELECT id FROM banners WHERE deleted_at IS NULL AND banner_for=?`, data.placement)
    if (current.length !== data.ids.length || current.some(row => !data.ids.includes(row.id))) throw new Error('The banners have changed. Refresh and try again.')
    const db = (env as any).DB
    await db.batch(data.ids.map((id, index) => db.prepare(`INSERT INTO banner_order (banner_id,sort_order) VALUES (?,?) ON CONFLICT(banner_id) DO UPDATE SET sort_order=excluded.sort_order`).bind(id,index + 1)))
    return { ok: true }
  })
export const adminSaveHeroBanner = createServerFn({ method: 'POST' })
  .validator((input: { id?: number; title: string; type: string; type_id: number; banner_for: string; status: number; file_url: string; poster_url: string; design: unknown }) => input)
  .handler(async ({ data }) => {
    await requireAdmin()
    const { validateHeroDesign } = await import('./banner-design')
    const design = validateHeroDesign(data.design)
    if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw new Error('Enter a title of up to 200 characters.')
    if (!['movie', 'tvshow', 'teaching', 'video'].includes(data.type) || !['home', 'movie', 'tv_show', 'teaching', 'video'].includes(data.banner_for)) throw new Error('Choose a valid type and placement.')
    positiveId(data.type_id)
    if (![0, 1].includes(data.status)) throw new Error('Choose a valid status.')
    const target = data.type === 'video'
      ? await first(`SELECT id FROM videos WHERE id = ? AND deleted_at IS NULL`, data.type_id)
      : await first(`SELECT id FROM entertainments WHERE id = ? AND type = ? AND deleted_at IS NULL`, data.type_id, data.type)
    if (!target) throw new Error('Choose an existing title of this type.')
    const desktop = safeArtworkUrl(data.file_url), phone = safeArtworkUrl(data.poster_url)
    let previous: { banner_for: string } | null = null
    if (data.id !== undefined) {
      positiveId(data.id)
      previous = await first(`SELECT banner_for FROM banners WHERE id = ? AND deleted_at IS NULL`, data.id)
      if (!previous) throw new Error('Banner not found.')
    }
    const db = (env as any).DB
    const values = [data.title.trim(), data.type, data.type_id, data.banner_for, data.status, desktop, phone]
    const statements = [
      data.id
        ? db.prepare(`UPDATE banners SET title=?, type=?, type_id=?, banner_for=?, status=?, file_url=?, poster_url=?, updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL`).bind(...values, data.id)
        : db.prepare(`INSERT INTO banners (title,type,type_id,banner_for,status,file_url,poster_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).bind(...values),
      data.id
        ? db.prepare(`INSERT INTO banner_designs (banner_id,design_json) VALUES (?,?) ON CONFLICT(banner_id) DO UPDATE SET design_json=excluded.design_json, updated_at=datetime('now')`).bind(data.id, JSON.stringify(design))
        : db.prepare(`INSERT INTO banner_designs (banner_id,design_json) SELECT seq,? FROM sqlite_sequence WHERE name='banners'`).bind(JSON.stringify(design)),
    ]
    // Keep an edited hero in place; a new hero or one moved to another placement is appended.
    if (!data.id) {
      // Read the new ID inside this batch, after the banner INSERT.
      statements.push(db.prepare(`INSERT INTO banner_order (banner_id,sort_order)
        SELECT (SELECT seq FROM sqlite_sequence WHERE name='banners'),COALESCE(MAX(COALESCE(o.sort_order,b.id)),0)+1
        FROM banners b LEFT JOIN banner_order o ON o.banner_id=b.id
        WHERE b.banner_for=? AND b.deleted_at IS NULL AND b.id!=(SELECT seq FROM sqlite_sequence WHERE name='banners')`).bind(data.banner_for))
    } else if (previous?.banner_for !== data.banner_for) {
      statements.push(db.prepare(`INSERT INTO banner_order (banner_id,sort_order)
        SELECT ?, COALESCE(MAX(COALESCE(o.sort_order,b.id)),0)+1 FROM banners b LEFT JOIN banner_order o ON o.banner_id=b.id
        WHERE b.banner_for=? AND b.deleted_at IS NULL AND b.id!=?
        ON CONFLICT(banner_id) DO UPDATE SET sort_order=excluded.sort_order`).bind(data.id, data.banner_for, data.id))
    }
    const results = await db.batch(statements)
    return { ok: true, id: data.id ?? results[0].meta.last_row_id }
  })
