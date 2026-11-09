import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { requireAdmin } from './admin'
import { all, first, run } from './db'
import {
  assertMediaOrigin, assetFolder, boundedBytes, classifyUpload, cleanOcrResult, imageSignature,
  MAX_UPLOAD, MediaError, mediaKind, mediaUrl, OCR_BATCH_SIZE, publicMediaKey, requireMediaKey,
  SCAN_BATCH_SIZE, validFilters, type MediaAsset, type MediaFilters,
} from './media-library-core'

const bindings = () => env as any
const now = () => Math.floor(Date.now() / 1000)
async function adminMutation() {
  assertMediaOrigin(getRequest())
  return requireAdmin()
}
export async function mediaRateLimit(uid: number, action: string, maximum: number) {
  const time = now(); const bucket = `${action}:${uid}:${Math.floor(time / 60)}`
  const row = await first<{ count: number }>(`INSERT INTO media_action_limits(bucket,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`, bucket, time + 120)
  if (!row || row.count > maximum) throw new MediaError(429, 'Please wait a minute before trying again.')
  await run('DELETE FROM media_action_limits WHERE expires_at < ?', time)
}
export async function indexStoredObject(object: { key: string; size: number; etag: string; uploaded?: Date | string }, generation?: number) {
  const key = requireMediaKey(object.key); const kind = mediaKind(key)
  const status = kind === 'image' && object.size <= MAX_UPLOAD ? 'pending' : 'unsupported'
  const gen = generation ?? (await first<any>('SELECT generation FROM media_scan_state WHERE id=1'))?.generation ?? 0
  await run(`INSERT INTO media_asset_index(key,name,folder,size,etag,uploaded,kind,ocr_status,seen_scan)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.name ELSE excluded.name END,folder=excluded.folder,size=excluded.size,
    uploaded=excluded.uploaded,kind=excluded.kind,seen_scan=excluded.seen_scan,
    ocr_status=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.ocr_status ELSE excluded.ocr_status END,
    ocr_text=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.ocr_text ELSE '' END,
    confidence=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.confidence ELSE NULL END,
    ocr_error=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.ocr_error ELSE NULL END,
    lease=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.lease ELSE NULL END,
    lease_until=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.lease_until ELSE NULL END,
    attempts=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.attempts ELSE 0 END,
    etag=excluded.etag,updated_at=CURRENT_TIMESTAMP`,
    key, key.split('/').pop(), assetFolder(key), object.size, object.etag,
    object.uploaded ? new Date(object.uploaded).toISOString() : null, kind, status, gen)
}

export async function listMediaLibrary(value?: MediaFilters) {
    const data = validFilters(value)
    await requireAdmin()
    const clauses: string[] = []; const params: any[] = []
    if (data.kind) { clauses.push('kind=?'); params.push(data.kind) }
    if (data.folder) { clauses.push('folder=?'); params.push(data.folder) }
    if (data.from) { clauses.push('uploaded >= ?'); params.push(data.from + 'T00:00:00.000Z') }
    if (data.to) { clauses.push('uploaded < ?'); params.push(new Date(Date.parse(data.to) + 86400000).toISOString()) }
    if (data.query) {
      clauses.push(data.mode === 'text' ? "ocr_status='ready' AND instr(lower(ocr_text),lower(?))>0" : "instr(lower(name),lower(?))>0")
      params.push(data.query)
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
    try {
      const [assets, count, totals, folders, scan] = await Promise.all([
        all<MediaAsset>(`SELECT key,name,folder,size,uploaded,etag,kind,ocr_status,substr(ocr_text,1,500) AS ocr_text,ocr_error,confidence
          FROM media_asset_index ${where} ORDER BY uploaded DESC,key LIMIT 48 OFFSET ?`, ...params, data.offset),
        first<any>(`SELECT COUNT(*) AS total FROM media_asset_index ${where}`, ...params),
        all<any>('SELECT ocr_status AS status,COUNT(*) AS count FROM media_asset_index GROUP BY ocr_status'),
        all<any>(`SELECT folder,COUNT(*) AS count,(SELECT key FROM media_asset_index b WHERE b.folder=a.folder AND b.kind='image' ORDER BY uploaded DESC LIMIT 1) AS cover
          FROM media_asset_index a GROUP BY folder ORDER BY folder`),
        first<any>('SELECT finished,discovered,generation,updated_at FROM media_scan_state WHERE id=1'),
      ])
      return { ok: true, assets: assets.filter(a => publicMediaKey(a.key)).map(a => ({ ...a, url: mediaUrl(a.key) })), total: Number(count?.total ?? 0), totals, folders: folders.map(f => ({ ...f, cover: f.cover && publicMediaKey(f.cover) ? mediaUrl(f.cover) : null })), scan, error: null }
    } catch {
      return { ok: false, assets: [] as MediaAsset[], total: 0, totals: [] as any[], folders: [] as any[], scan: null, error: 'The media index is not available yet. Apply the media library database migration before indexing.' }
    }
}

/** One persistent discovery page per request. The cursor survives page close/reload. */
export async function discoverMediaBatch(value?: { restart?: boolean }) {
    const data = { restart: value?.restart === true }
    const user = await adminMutation(); await mediaRateLimit(user.uid, 'discover', 30)
    const bucket = bindings().MEDIA
    if (!bucket?.list) throw new MediaError(503, 'Media storage is unavailable.')
    const lease = crypto.randomUUID(); const time = now()
    const locked = await first<any>(`UPDATE media_scan_state SET lease=?,lease_until=? WHERE id=1 AND (lease IS NULL OR lease_until < ?) RETURNING *`, lease, time + 90, time)
    if (!locked) throw new MediaError(409, 'Another administrator is discovering media. Try again shortly.')
    try {
      if (locked.finished && !data.restart) return { finished: true, discovered: locked.discovered, added: 0 }
      let generation = locked.generation; let cursor = locked.cursor; let discovered = locked.discovered
      if (locked.finished || generation === 0) { generation += 1; cursor = null; discovered = 0 }
      const page = await bucket.list({ limit: SCAN_BATCH_SIZE, ...(cursor ? { cursor } : {}) })
      // Never silently truncate an oversized response: its cursor would skip
      // files. Fail before indexing and keep the persisted cursor for retry.
      if (!Array.isArray(page.objects) || page.objects.length > SCAN_BATCH_SIZE) throw new MediaError(502, 'Media discovery returned an invalid page. Please try again.')
      let added = 0
      for (const object of page.objects ?? []) {
        if (!publicMediaKey(object.key)) continue
        await indexStoredObject(object, generation); added += 1
      }
      const finished = !page.truncated
      // Index deletion only; this never deletes R2 media. New uploads carry the current generation.
      if (finished) await run('DELETE FROM media_asset_index WHERE seen_scan < ? AND updated_at < ?', generation, new Date(time * 1000).toISOString().replace('T',' ').slice(0,19))
      await run(`UPDATE media_scan_state SET cursor=?,generation=?,finished=?,discovered=?,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND lease=?`,
        finished ? null : page.cursor, generation, finished ? 1 : 0, discovered + added, lease)
      return { finished, discovered: discovered + added, added }
    } finally { await run('UPDATE media_scan_state SET lease=NULL,lease_until=NULL WHERE id=1 AND lease=?', lease) }
}

export async function claimMediaOcr(value?: { retryErrors?: boolean }) {
    const data = { retryErrors: value?.retryErrors === true }
    const user = await adminMutation(); await mediaRateLimit(user.uid, 'ocr-claim', 30)
    const time = now(); const candidates = await all<any>(`SELECT key,etag FROM media_asset_index WHERE kind='image' AND size <= ?
      AND (ocr_status='pending' OR (ocr_status='processing' AND lease_until < ?) ${data.retryErrors ? "OR ocr_status='error'" : ''}) ORDER BY uploaded DESC LIMIT ?`, MAX_UPLOAD, time, OCR_BATCH_SIZE)
    const jobs: { key: string; url: string; etag: string; lease: string }[] = []
    for (const row of candidates) {
      if (!publicMediaKey(row.key)) continue
      const lease = crypto.randomUUID()
      const changed = await first<any>(`UPDATE media_asset_index SET ocr_status='processing',lease=?,lease_owner=?,lease_until=?,attempts=attempts+1,ocr_error=NULL
        WHERE key=? AND etag=? AND (ocr_status='pending' OR (ocr_status='processing' AND lease_until < ?) ${data.retryErrors ? "OR ocr_status='error'" : ''}) RETURNING key`, lease, user.uid, time + 600, row.key, row.etag, time)
      if (changed) jobs.push({ key: row.key, url: mediaUrl(row.key), etag: row.etag, lease })
    }
    return jobs
}

export async function completeMediaOcr(value: { key: string; etag: string; lease: string; text?: string; confidence?: number; error?: string }) {
    requireMediaKey(value?.key)
    if (typeof value.etag !== 'string' || !value.etag || value.etag.length > 200 || !/^[a-f\d-]{36}$/.test(value.lease)) throw new MediaError(400, 'Invalid indexing job.')
    const data = { ...value, result: cleanOcrResult(value) }
    const user = await adminMutation(); await mediaRateLimit(user.uid, 'ocr-complete', 90)
    // A replaced or deleted object must not receive text from stale pixels.
    const object = await bindings().MEDIA.head(data.key)
    if (!object || object.etag !== data.etag) {
      if (object) await indexStoredObject(object)
      else await run('DELETE FROM media_asset_index WHERE key=?', data.key)
      throw new MediaError(409, 'This image changed during indexing. It has been queued again.')
    }
    const { status, text, confidence, error } = data.result
    const updated = await first<any>(`UPDATE media_asset_index SET ocr_status=?,ocr_text=?,confidence=?,ocr_error=?,lease=NULL,lease_until=NULL,indexed_at=CURRENT_TIMESTAMP
      WHERE key=? AND etag=? AND lease=? AND lease_owner=? AND lease_until >= ? AND ocr_status='processing' RETURNING key`,
      status, text, confidence, error, data.key, data.etag, data.lease, user.uid, now())
    if (!updated) throw new MediaError(409, 'This indexing job expired. Resume indexing to try again.')
    return { ok: true }
}

const REFERENCE_FIELDS: Record<string, string[]> = {
  entertainments: ['poster_url','thumbnail_url','seo_image','subtitle_file'], videos: ['poster_url','thumbnail_url','seo_image','subtitle_file'],
  episodes: ['poster_url','subtitle_file'], seasons: ['poster_url'], banners: ['file_url','poster_url','design_json'],
  banner_designs: ['design_json'], custom_ads_setting: ['media'], users: ['file_url'], user_multi_profiles: ['avatar'],
  genres: ['file_url'], cast_crew: ['file_url'], locations: ['file_url'], onboardings: ['file_url'],
  live_tv_channel: ['poster_url','thumbnail_url','file_url'], live_tv_category: ['file_url'], settings: ['val'],
}
export async function assertMediaUnused(key: string) {
  // Earlier imports wrote raw paths, while newer forms use encoded URLs.
  // Match both spellings so spaces/non-ASCII names cannot bypass protection.
  const urls = [...new Set([mediaUrl(key), '/media/' + requireMediaKey(key)])]
  for (const [table, allowed] of Object.entries(REFERENCE_FIELDS)) {
    const schema = await all<any>(`PRAGMA table_info(${table})`)
    const fields = allowed.filter(field => schema.some(column => column.name === field))
    if (!fields.length) continue
    const predicates = fields.flatMap(field => urls.map(url => ({ sql: `instr(${field},?)>0`, value: url })))
    const match = await first(`SELECT 1 FROM ${table} WHERE ${predicates.map(item => item.sql).join(' OR ')} LIMIT 1`, ...predicates.map(item => item.value))
    if (match) throw new MediaError(409, 'This file is still used by content or settings. Replace those references before deleting it.')
  }
}
export async function deleteLibraryMedia(data: { key: string; etag: string }) {
    requireMediaKey(data?.key)
    if (typeof data.etag !== 'string' || !data.etag || data.etag.length > 200) throw new MediaError(400, 'Invalid file version.')
    const user = await adminMutation(); await mediaRateLimit(user.uid, 'delete', 20)
    const indexed = await first('SELECT key FROM media_asset_index WHERE key=? AND etag=?', data.key, data.etag)
    if (!indexed) throw new MediaError(404, 'The file is no longer in the media library.')
    const object = await bindings().MEDIA.head(data.key)
    if (object && object.etag !== data.etag) throw new MediaError(409, 'This file changed. Refresh before deleting it.')
    await assertMediaUnused(data.key)
    if (object) await bindings().MEDIA.delete(data.key)
    await run('DELETE FROM media_asset_index WHERE key=? AND etag=?', data.key, data.etag)
    await run('INSERT INTO media_audit_events(user_id,action,media_key) VALUES(?,?,?)', user.uid, 'delete', data.key)
    return { ok: true }
}

/** No original raster is persisted: only verified encoder output enters R2. */
export async function storeMediaUpload(file: File, uid: number) {
  const bytes = await boundedBytes(file.stream(), MAX_UPLOAD)
  const format = classifyUpload(file.name, bytes)
  let stored: Uint8Array = bytes; let ext = format.ext; let contentType = format.type
  if (format.kind === 'image') {
    const images = bindings().IMAGES
    if (!images?.input || !images?.info) throw new MediaError(503, 'Image conversion is not configured. Enable the Images binding before uploading images.')
    try {
      const stream = () => new Blob([bytes.buffer as ArrayBuffer]).stream()
      const info = await images.info(stream())
      if (!Number.isFinite(info.width) || !Number.isFinite(info.height) || info.width < 1 || info.height < 1 || info.width * info.height > 40_000_000) throw new MediaError(415, 'Choose an image smaller than 40 megapixels.')
      const result = await images.input(stream()).transform({ width: 3840, height: 3840, fit: 'scale-down' }).output({ format: 'image/avif', quality: 75, anim: false })
      const response = result.response()
      stored = await boundedBytes(response.body, MAX_UPLOAD)
      if (imageSignature(stored) !== 'avif') throw new MediaError(502, 'Image conversion did not produce AVIF. Please try again.')
      ext = 'avif'; contentType = 'image/avif'
    } catch (error) { if (error instanceof MediaError) throw error; throw new MediaError(502, 'The image could not be converted. Try another image.') }
  }
  const key = `uploads/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}.${ext}`
  const object = await bindings().MEDIA.put(key, stored, { httpMetadata: {
    contentType, cacheControl: 'public, max-age=31536000, immutable',
    ...(format.kind === 'document' ? { contentDisposition: `attachment; filename="document.pdf"` } : {}),
  }, customMetadata: { originalName: file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,180) } })
  if (!object) throw new MediaError(503, 'Media storage is unavailable.')
  try {
    await indexStoredObject({ key, size: stored.length, etag: object.etag, uploaded: object.uploaded ?? new Date() })
    await run('UPDATE media_asset_index SET name=? WHERE key=?', file.name.slice(0,180).replace(/\.[^.]+$/, '.' + ext), key)
    await run('INSERT INTO media_audit_events(user_id,action,media_key) VALUES(?,?,?)', uid, 'upload', key)
  } catch {
    // No success URL escapes without a usable index. Remove this new UUID only.
    await bindings().MEDIA.delete(key)
    await run('DELETE FROM media_asset_index WHERE key=?', key).catch(() => {})
    throw new MediaError(503, 'The media index is unavailable. The upload was not saved; please try again later.')
  }
  return { ok: true, url: mediaUrl(key), key }
}

export async function releaseMediaOcr(data: { key: string; lease: string }[]) {
    if (!Array.isArray(data) || data.length > OCR_BATCH_SIZE) throw new MediaError(400, 'Invalid indexing batch.')
    for (const job of data) { requireMediaKey(job?.key); if (!/^[a-f\d-]{36}$/.test(job.lease)) throw new MediaError(400, 'Invalid indexing job.') }
    const user = await adminMutation()
    for (const job of data) await run(`UPDATE media_asset_index SET ocr_status='pending',lease=NULL,lease_until=NULL WHERE key=? AND lease=? AND lease_owner=? AND ocr_status='processing'`, job.key, job.lease, user.uid)
    return { ok: true }
}
