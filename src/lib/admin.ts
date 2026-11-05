import { createServerFn } from '@tanstack/react-start'
import { getSession } from './session.server'
import { all, first, run } from './db'

const ADMIN_TYPES = ['admin', 'demo_admin']

export class AdminError extends Error {
  code: 'needsAuth' | 'forbidden'
  constructor(code: 'needsAuth' | 'forbidden', message: string) {
    super(message)
    this.code = code
  }
}

async function requireAdmin(): Promise<{ uid: number; email: string }> {
  const session = await getSession()
  if (!session) throw new AdminError('needsAuth', 'Sign in required.')
  const user = await first<any>(
    `SELECT id, email, user_type FROM users WHERE id = ? AND deleted_at IS NULL`,
    session.uid,
  )
  if (!user || !ADMIN_TYPES.includes(user.user_type)) {
    throw new AdminError('forbidden', 'Admin access required.')
  }
  return { uid: user.id, email: user.email }
}

export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  const user = await first<any>(
    `SELECT id, email, first_name, last_name, user_type FROM users WHERE id = ? AND deleted_at IS NULL`,
    session.uid,
  )
  if (!user || !ADMIN_TYPES.includes(user.user_type)) return null
  return user
})

// ---------- dashboard ----------

export const getAdminStats = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const c = async (sql: string) =>
    (await first<{ n: number }>(sql).catch(() => ({ n: 0 })))?.n ?? 0
  const [movies, tvshows, videos, channels, users, genres, plans, activeSubs, cast, soonToExpire, reviews, rentContent] =
    await Promise.all([
      c(`SELECT COUNT(*) n FROM entertainments WHERE type='movie' AND deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM entertainments WHERE type='tvshow' AND deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM videos WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM live_tv_channel WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM genres WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM plan WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM subscriptions WHERE status = 'active' AND deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM cast_crew WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM subscriptions WHERE status = 'active' AND deleted_at IS NULL AND end_date <= date('now', '+30 days')`),
      c(`SELECT COUNT(*) n FROM reviews WHERE deleted_at IS NULL`),
      c(`SELECT COUNT(*) n FROM pay_per_views`),
    ])
  const revenue = await first<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM subscriptions_transactions WHERE payment_status = 'paid'`,
  ).catch(() => ({ total: 0 }))
  const rentRevenue = await first<{ total: number }>(
    `SELECT COALESCE(SUM(price), 0) AS total FROM pay_per_views`,
  ).catch(() => ({ total: 0 }))
  const monthly = async (table: string, where = '', soft = true) =>
    all(
      `SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS n FROM ${table}
       WHERE created_at IS NOT NULL ${soft ? 'AND deleted_at IS NULL' : ''} ${where} GROUP BY m ORDER BY m DESC LIMIT 6`,
    ).catch(() => [])
  const [usersM, moviesM, tvshowsM, videosM, channelsM, genresM, plansM, subsM, castM, reviewsM, rentM] =
    await Promise.all([
      monthly('users'),
      monthly('entertainments', `AND type='movie'`),
      monthly('entertainments', `AND type='tvshow'`),
      monthly('videos'),
      monthly('live_tv_channel'),
      monthly('genres'),
      monthly('plan'),
      monthly('subscriptions'),
      monthly('cast_crew'),
      monthly('reviews'),
      monthly('pay_per_views', '', false),
    ])
  const genreTop = await all(
    `SELECT g.name, COUNT(*) AS n FROM entertainment_gener_mapping m
     JOIN genres g ON g.id = m.genre_id AND g.deleted_at IS NULL
     GROUP BY g.id ORDER BY n DESC LIMIT 5`,
  ).catch(() => [])
  const recentUsers = await all(
    `SELECT id, first_name, last_name, email, user_type, created_at FROM users WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 6`,
  )
  const recentContent = await all(
    `SELECT id, name, type, release_date, status FROM entertainments WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 6`,
  )
  const recentTransactions = await all(
    `SELECT t.id, t.amount, t.payment_type, t.payment_status, t.created_at, u.email
     FROM subscriptions_transactions t LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.id DESC LIMIT 6`,
  ).catch(() => [])
  return {
    counts: { movies, tvshows, videos, channels, users, genres, plans, activeSubs, cast, soonToExpire, reviews, rentContent },
    revenue: revenue?.total ?? 0,
    rentRevenue: rentRevenue?.total ?? 0,
    monthly: {
      users: usersM, movies: moviesM, tvshows: tvshowsM, videos: videosM,
      channels: channelsM, genres: genresM, plans: plansM, activeSubs: subsM, cast: castM,
      reviews: reviewsM, rentContent: rentM, soonToExpire: subsM,
    },
    genreTop,
    recentUsers,
    recentContent,
    recentTransactions,
  }
})

// ---------- content CRUD ----------

export const adminListContent = createServerFn({ method: 'GET' })
  .validator((type: string) => type)
  .handler(async ({ data: type }) => {
    await requireAdmin()
    return all(
      `SELECT e.id, e.name, e.type, e.release_date, e.language, e.movie_access, e.content_rating,
              e.IMDb_rating, e.duration, e.status, e.created_at,
              (SELECT COUNT(*) FROM entertainment_views v WHERE v.entertainment_id = e.id) AS views
       FROM entertainments e WHERE e.type = ? AND e.deleted_at IS NULL ORDER BY e.id DESC`,
      type,
    )
  })

export interface ContentInput {
  id?: number
  name: string
  type: 'movie' | 'tvshow'
  description?: string
  release_date?: string
  language?: string
  movie_access?: string
  content_rating?: string
  IMDb_rating?: string
  duration?: string
  status?: number
  poster_url?: string
  thumbnail_url?: string
}

export const adminUpsertContent = createServerFn({ method: 'POST' })
  .validator((d: ContentInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    if (!data.name?.trim()) throw new Error('Name is required.')
    if (!['movie', 'tvshow'].includes(data.type)) throw new Error('Type must be movie or tvshow.')
    if (data.id) {
      await run(
        `UPDATE entertainments SET name=?, description=?, release_date=?, language=?, movie_access=?,
         content_rating=?, IMDb_rating=?, duration=?, status=?, poster_url=?, thumbnail_url=?,
         updated_by=?, updated_at=datetime('now')
         WHERE id=? AND deleted_at IS NULL`,
        data.name.trim(),
        data.description ?? null,
        data.release_date ?? null,
        data.language ?? null,
        data.movie_access ?? 'free',
        data.content_rating ?? null,
        data.IMDb_rating ?? null,
        data.duration ?? null,
        data.status ?? 1,
        data.poster_url ?? null,
        data.thumbnail_url ?? null,
        admin.uid,
        data.id,
      )
      return { ok: true, id: data.id }
    }
    const res = await run(
      `INSERT INTO entertainments (name, description, type, release_date, language, movie_access,
        content_rating, IMDb_rating, duration, status, poster_url, thumbnail_url,
        slug, created_by, updated_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      data.name.trim(),
      data.description ?? null,
      data.type,
      data.release_date ?? null,
      data.language ?? null,
      data.movie_access ?? 'free',
      data.content_rating ?? null,
      data.IMDb_rating ?? null,
      data.duration ?? null,
      data.status ?? 1,
      data.poster_url ?? null,
      data.thumbnail_url ?? null,
      data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      admin.uid,
      admin.uid,
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
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
    `SELECT id, name, release_date, duration, IMDb_rating, status, created_at
     FROM videos WHERE deleted_at IS NULL ORDER BY id DESC`,
  )
})

export const adminUpsertVideo = createServerFn({ method: 'POST' })
  .validator((d: { id?: number; name: string; description?: string; duration?: string; release_date?: string; status?: number }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdmin()
    if (!data.name?.trim()) throw new Error('Name is required.')
    if (data.id) {
      await run(
        `UPDATE videos SET name=?, description=?, duration=?, release_date=?, status=?, updated_by=?, updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL`,
        data.name.trim(), data.description ?? null, data.duration ?? null,
        data.release_date ?? null, data.status ?? 1, admin.uid, data.id,
      )
      return { ok: true, id: data.id }
    }
    const res = await run(
      `INSERT INTO videos (name, description, duration, release_date, status, slug, created_by, updated_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      data.name.trim(), data.description ?? null, data.duration ?? null,
      data.release_date ?? null, data.status ?? 1,
      data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      admin.uid, admin.uid,
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
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
  const channels = await all(
    `SELECT c.id, c.name, c.access, c.status, cat.name AS category
     FROM live_tv_channel c LEFT JOIN live_tv_category cat ON cat.id = c.category_id
     WHERE c.deleted_at IS NULL ORDER BY c.id DESC`,
  )
  const categories = await all(
    `SELECT id, name, status FROM live_tv_category ORDER BY name`,
  ).catch(() => [])
  return { channels, categories }
})

export const adminUpsertChannel = createServerFn({ method: 'POST' })
  .validator((d: { id?: number; name: string; category_id?: number; access?: string; description?: string; status?: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (!data.name?.trim()) throw new Error('Name is required.')
    if (data.id) {
      await run(
        `UPDATE live_tv_channel SET name=?, category_id=?, access=?, description=?, status=? WHERE id=? AND deleted_at IS NULL`,
        data.name.trim(), data.category_id ?? null, data.access ?? 'free',
        data.description ?? null, data.status ?? 1, data.id,
      )
      return { ok: true, id: data.id }
    }
    const res = await run(
      `INSERT INTO live_tv_channel (name, category_id, access, description, status) VALUES (?,?,?,?,?)`,
      data.name.trim(), data.category_id ?? null, data.access ?? 'free',
      data.description ?? null, data.status ?? 1,
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
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
    `SELECT g.id, g.name, g.slug, g.status,
            (SELECT COUNT(*) FROM entertainment_gener_mapping m WHERE m.genre_id = g.id) AS titles
     FROM genres g WHERE g.deleted_at IS NULL ORDER BY g.name`,
  )
})

export const adminUpsertGenre = createServerFn({ method: 'POST' })
  .validator((d: { id?: number; name: string; status?: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    if (!data.name?.trim()) throw new Error('Name is required.')
    const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (data.id) {
      await run(
        `UPDATE genres SET name=?, slug=?, status=? WHERE id=? AND deleted_at IS NULL`,
        data.name.trim(), slug, data.status ?? 1, data.id,
      )
      return { ok: true, id: data.id }
    }
    const res = await run(
      `INSERT INTO genres (name, slug, status, created_at, updated_at) VALUES (?,?,?,datetime('now'),datetime('now'))`,
      data.name.trim(), slug, data.status ?? 1,
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

// ---------- generic read-only admin tables (Batch F) ----------

const ADMIN_TABLES: Record<string, string> = {
  'media-library': `SELECT id, name, file_name, mime_type, size, created_at FROM media ORDER BY id DESC LIMIT 200`,
  seasons: `SELECT s.id, s.name, s.poster_url, s.status, e.name AS show FROM seasons s LEFT JOIN entertainments e ON e.id = s.entertainment_id WHERE s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 300`,
  episodes: `SELECT ep.id, ep.name, ep.poster_url, ep.status, ep.duration, e.name AS show, s.name AS season FROM episodes ep LEFT JOIN entertainments e ON e.id = ep.entertainment_id LEFT JOIN seasons s ON s.id = ep.season_id WHERE ep.deleted_at IS NULL ORDER BY ep.id DESC LIMIT 300`,
  'tv-category': `SELECT id, name, file_url, status FROM live_tv_category WHERE deleted_at IS NULL ORDER BY name`,
  actors: `SELECT id, name, file_url, designation, status FROM cast_crew WHERE type = 'actor' AND deleted_at IS NULL ORDER BY id LIMIT 300`,
  directors: `SELECT id, name, file_url, designation, status FROM cast_crew WHERE type = 'director' AND deleted_at IS NULL ORDER BY id LIMIT 300`,
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
    return all(sql).catch(() => [])
  })

// ---------- generic CRUD (feature-replication of Laravel add/edit/delete) ----------

const CRUD_ENTITIES: Record<string, { table: string; fields: string[]; fixed?: Record<string, any> }> = {
  seasons: { table: 'seasons', fields: ['name', 'entertainment_id', 'season_number', 'poster_url', 'access', 'price', 'short_desc', 'description', 'status'] },
  episodes: { table: 'episodes', fields: ['name', 'entertainment_id', 'season_id', 'episode_number', 'duration', 'release_date', 'poster_url', 'video_url_input', 'access', 'price', 'short_desc', 'description', 'status'] },
  actors: { table: 'cast_crew', fields: ['name', 'designation', 'file_url', 'dob', 'place_of_birth', 'bio', 'status'], fixed: { type: 'actor' } },
  directors: { table: 'cast_crew', fields: ['name', 'designation', 'file_url', 'dob', 'place_of_birth', 'bio', 'status'], fixed: { type: 'director' } },
  coupons: { table: 'coupons', fields: ['code', 'description', 'discount_type', 'discount', 'start_date', 'expire_date', 'status'] },
  banners: { table: 'banners', fields: ['title', 'type', 'type_id', 'banner_for', 'file_url', 'poster_url', 'status'] },
  faq: { table: 'faqs', fields: ['question', 'answer', 'status'] },
  tax: { table: 'taxes', fields: ['title', 'type', 'value', 'status'] },
  pages: { table: 'pages', fields: ['name', 'slug', 'description', 'status'] },
  onboarding: { table: 'onboardings', fields: ['title', 'description', 'file_url', 'status'] },
  'plan-limits': { table: 'planlimitation', fields: ['title', 'slug', 'description', 'status'] },
  'vast-ads': { table: 'vast_ads_setting', fields: ['name', 'type', 'url', 'duration', 'target_type', 'enable_skip', 'skip_after', 'frequency', 'start_date', 'end_date', 'status'] },
  'custom-ads': { table: 'custom_ads_setting', fields: ['name', 'type', 'url_type', 'placement', 'redirect_url', 'duration', 'skip_enabled', 'skip_after', 'status'] },
  'tv-category': { table: 'live_tv_category', fields: ['name', 'file_url', 'description', 'status'] },
  'notification-templates': { table: 'notification_templates', fields: ['name', 'label', 'type', 'description', 'status'] },
  reviews: { table: 'reviews', fields: [] },
}

function entityFor(key: string) {
  const e = CRUD_ENTITIES[key]
  if (!e) throw new Error(`unknown entity: ${key}`)
  return e
}

export const adminOptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const shows = await all(`SELECT id, name FROM entertainments WHERE type = 'tvshow' AND deleted_at IS NULL ORDER BY name LIMIT 500`)
  const seasons = await all(`SELECT id, name, entertainment_id FROM seasons WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 500`)
  const contents = await all(`SELECT id, name, type FROM entertainments WHERE deleted_at IS NULL ORDER BY name LIMIT 500`)
  return { shows, seasons, contents }
})

export const adminGetRow = createServerFn({ method: 'GET' })
  .validator((d: { entity: string; id: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    const e = entityFor(data.entity)
    const row = await first<any>(`SELECT * FROM ${e.table} WHERE id = ?`, data.id)
    if (!row) throw new Error('not found')
    const out: Record<string, any> = { id: row.id }
    for (const f of e.fields) out[f] = row[f]
    return out
  })

export const adminUpsertRow = createServerFn({ method: 'POST' })
  .validator((d: { entity: string; id?: number; values: Record<string, any> }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    const e = entityFor(data.entity)
    const vals: Record<string, any> = {}
    for (const f of e.fields) {
      if (f in data.values) {
        let v = data.values[f]
        if (typeof v === 'string') v = v.trim()
        if (v === '') v = null
        vals[f] = v
      }
    }
    if (Object.keys(vals).length === 0 && !data.id) throw new Error('nothing to save')
    if (data.id) {
      const sets = Object.keys(vals).map((k) => `${k} = ?`).join(', ')
      if (sets) await run(`UPDATE ${e.table} SET ${sets}, updated_at = datetime('now') WHERE id = ?`, ...Object.values(vals), data.id)
      return { ok: true, id: data.id }
    }
    const merged = { ...(e.fixed ?? {}), ...vals }
    const cols = Object.keys(merged)
    const res = await run(
      `INSERT INTO ${e.table} (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`,
      ...Object.values(merged),
    )
    return { ok: true, id: (res as any)?.meta?.last_row_id ?? null }
  })

export const adminDeleteRow = createServerFn({ method: 'POST' })
  .validator((d: { entity: string; id: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin()
    const e = entityFor(data.entity)
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
