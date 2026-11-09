#!/usr/bin/env node
/** Bounded operational OCR backfill. Default is read-only; --apply writes only
 * media_asset_index. Uses existing Wrangler OAuth, never application sessions.
 * All OCR input is fetched from current public R2 bytes; historical manifests,
 * filenames, sidecars and database titles are never treated as recognized text.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, chmodSync, openSync, closeSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TARGET = Object.freeze({ account: 'e020be7b99894463ef06f38b8c4aef8e', bucket: 'halobox-migrated-media-20261105', database: '3bc8aa15-6d59-42be-93df-23397c737c56' })
const MAX_BYTES = 10 * 1024 * 1024
const MAX_OBJECTS = 25_000
const API_ROOT = `https://api.cloudflare.com/client/v4/accounts/${TARGET.account}`
const R2_PATH = `/r2/buckets/${TARGET.bucket}/objects`
const D1_PATH = `/d1/database/${TARGET.database}/query`
const STATE_DIR = path.join(ROOT, '.unlazy/nov08-queued/media-ocr-backfill')
const ENGINE = 'tesseract-7-eng-max2400-v1'
const safeEtag = value => typeof value === 'string' ? value.replace(/^"|"$/g, '') : ''
const now = () => Math.floor(Date.now() / 1000)

export function publicImage(object) {
  const { key, size, etag } = object ?? {}
  if (typeof key !== 'string' || !key || key.length > 1024 || /[\\%\x00-\x1f\x7f?#]/.test(key)) return false
  const parts = key.split('/')
  return !parts.some(p => !p || p === '.' || p === '..') && parts[0].toLowerCase() !== 'private'
    && /\.(avif|png|jpe?g|webp|gif|bmp)$/i.test(key) && Number.isSafeInteger(size) && size > 0 && size <= MAX_BYTES
    && typeof etag === 'string' && /^[a-zA-Z0-9-]{1,200}$/.test(safeEtag(etag))
}
export function needsOcr(object, row, retryErrors = false, time = now()) {
  if (!publicImage(object)) return false
  // Respect browser leases even when an object was replaced during that work.
  if (row?.lease && (!Number.isFinite(row.lease_until) || row.lease_until >= time)) return false
  if (row?.etag !== object.etag) return true
  return row.ocr_status === 'pending' || row.ocr_status === 'processing' || (retryErrors && row.ocr_status === 'error')
}
export function parseOptions(args) {
  const options = { apply: false, preview: false, limit: 100, workers: 2, retryErrors: false, help: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--apply') options.apply = true
    else if (arg === '--preview-ocr') options.preview = true
    else if (arg === '--retry-errors') options.retryErrors = true
    else if (arg === '--help') options.help = true
    else if (arg === '--limit' || arg === '--workers') {
      const value = Number(args[++i]); const max = arg === '--limit' ? 100 : 2
      if (!Number.isInteger(value) || value < 1 || value > max) throw Error(`${arg} must be from 1 to ${max}`)
      options[arg.slice(2)] = value
    } else throw Error(`Unknown argument: ${arg}`)
  }
  if (options.apply && options.preview) throw Error('Choose --apply or --preview-ocr, not both')
  return options
}

// One atomic index upsert, guarded by the original DB version and absence of an
// active UI lease. A browser's newly completed result always wins for that ETag.
export function resultStatement(object, snapshot, result, time = now()) {
  if (!publicImage(object)) throw Error('Invalid public image')
  if (!['ready', 'error'].includes(result.status) || typeof result.text !== 'string' || result.text.length > 100_000
    || (result.status === 'ready' && (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 100))) throw Error('Invalid OCR result')
  const uploaded = object.last_modified && Number.isFinite(Date.parse(object.last_modified)) ? new Date(object.last_modified).toISOString() : null
  return {
    sql: `INSERT INTO media_asset_index(key,name,folder,size,etag,uploaded,kind,ocr_status,ocr_text,confidence,ocr_error,attempts,seen_scan,indexed_at)
      VALUES(?,?,?,?,?,?,'image',?,?,?,?,1,COALESCE((SELECT generation FROM media_scan_state WHERE id=1),0),CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET name=CASE WHEN media_asset_index.etag=excluded.etag THEN media_asset_index.name ELSE excluded.name END,
      folder=excluded.folder,size=excluded.size,etag=excluded.etag,uploaded=excluded.uploaded,kind='image',
      ocr_status=excluded.ocr_status,ocr_text=excluded.ocr_text,confidence=excluded.confidence,ocr_error=excluded.ocr_error,
      lease=NULL,lease_owner=NULL,lease_until=NULL,attempts=media_asset_index.attempts+1,seen_scan=excluded.seen_scan,
      indexed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE media_asset_index.etag=? AND (media_asset_index.lease IS NULL OR media_asset_index.lease_until < ?)
      AND (media_asset_index.etag<>excluded.etag OR media_asset_index.ocr_status<>'ready') RETURNING key`,
    params: [object.key, object.key.split('/').pop(), object.key.includes('/') ? object.key.split('/')[0] : 'Unsorted',
      object.size, object.etag, uploaded, result.status, result.text, result.confidence ?? null, result.error ?? null,
      snapshot?.etag ?? null, time],
  }
}

export function createCloudflare(token, apply = false, fetcher = fetch) {
  if (!token) throw Error('No existing Wrangler OAuth credential; this script does not sign in')
  async function request(relative, init = {}) {
    // Network destination is fixed; redirects cannot forward credentials.
    const response = await fetcher(API_ROOT + relative, { ...init, redirect: 'error',
      headers: { ...init.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) { await response.body?.cancel(); throw Error(`Cloudflare HTTP ${response.status}; no automatic sign-in or retry performed`) }
    return response
  }
  async function json(relative, init) {
    const response = await request(relative, init); const body = await response.json()
    if (body.success !== true) throw Error(`Cloudflare request failed (${(body.errors ?? []).map(e => e.code).join(',') || 'unknown code'})`)
    return body
  }
  async function query(statement, mutation = false) {
    // Guard every write, even if called directly rather than through the CLI.
    if (mutation && !apply) throw Error('Read-only run: use --apply to write the media index')
    const sql = statement.sql.trim()
    if (mutation ? !sql.startsWith('INSERT INTO media_asset_index(') || sql.includes(';') : !/^SELECT\b/.test(sql) || sql.includes(';')) throw Error('Query outside the media indexing allowlist')
    const body = await json(D1_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(statement) })
    const result = body.result?.[0]
    if (!result?.success) throw Error('D1 query failed; ensure the media index migration is applied')
    if (!mutation && Number(result.meta?.rows_written ?? 0) !== 0) throw Error('Read-only query unexpectedly wrote rows')
    return result
  }
  return {
    async schemaReady() {
      // sqlite_master exists before our migration. A missing index is not an
      // API failure, and must not be inferred by swallowing authentication or
      // arbitrary HTTP 400 errors from an attempted index query.
      const result = await query({ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?,?)", params: ['media_asset_index', 'media_scan_state'] })
      const tables = new Set((result.results ?? []).map(row => row.name))
      return tables.has('media_asset_index') && tables.has('media_scan_state')
    },
    async inventory() {
      const objects = []; let cursor; const seen = new Set()
      for (let page = 0; page < 25; page++) {
        const params = new URLSearchParams({ per_page: '1000', ...(cursor ? { cursor } : {}) })
        const body = await json(`${R2_PATH}?${params}`)
        if (!Array.isArray(body.result)) throw Error('Unexpected R2 list response')
        objects.push(...body.result)
        if (objects.length > MAX_OBJECTS) throw Error('Inventory exceeds bounded 25,000-object limit')
        if (!body.result_info?.is_truncated) return objects
        cursor = body.result_info.cursor
        if (!cursor || seen.has(cursor)) throw Error('R2 pagination failed to advance')
        seen.add(cursor)
      }
      throw Error('R2 pagination exceeded bounded 25-page limit')
    },
    async rows(objects) {
      const found = new Map()
      for (let offset = 0; offset < objects.length; offset += 50) {
        const keys = objects.slice(offset, offset + 50).map(o => o.key)
        const result = await query({ sql: `SELECT key,etag,ocr_status,lease,lease_until FROM media_asset_index WHERE key IN (${keys.map(() => '?').join(',')})`, params: keys })
        for (const row of result.results ?? []) found.set(row.key, row)
      }
      return found
    },
    async bytes(object) {
      if (!publicImage(object)) throw Error('Invalid public image')
      const response = await request(`${R2_PATH}/${object.key.split('/').map(encodeURIComponent).join('/')}`)
      if (safeEtag(response.headers.get('etag')) !== object.etag) { await response.body?.cancel(); throw Error('Image changed since discovery') }
      const reader = response.body.getReader(); const chunks = []; let size = 0
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break
          size += value.byteLength
          if (size > MAX_BYTES) { await reader.cancel(); throw Error('Image exceeds 10 MB') }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
      if (size !== object.size) throw Error('Image size changed since discovery')
      return Buffer.concat(chunks, size)
    },
    async unchanged(object) {
      if (!publicImage(object)) throw Error('Invalid public image')
      // Cloudflare's REST object API does not support HEAD. Exact-prefix LIST
      // is a read-only ETag check; it does not fetch old or private object bytes.
      const body = await json(`${R2_PATH}?${new URLSearchParams({ prefix: object.key, per_page: '1' })}`)
      return body.result?.some(row => row.key === object.key && safeEtag(row.etag) === object.etag && row.size === object.size) === true
    },
    async write(object, snapshot, result) { return query(resultStatement(object, snapshot, result), true) },
  }
}

function readCredential() {
  const config = JSON.parse(readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8'))
  if (config.name !== 'gndottadmin' || config.r2_buckets?.find(b => b.binding === 'MEDIA')?.bucket_name !== TARGET.bucket
    || config.d1_databases?.find(d => d.binding === 'DB')?.database_id !== TARGET.database) throw Error('Repository storage bindings do not match this approved backfill target')
  const configPath = path.join(homedir(), 'Library/Preferences/.wrangler/config/default.toml')
  const text = readFileSync(configPath, 'utf8')
  const token = text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1]
  if (!token) throw Error('No existing Wrangler OAuth credential; this script does not sign in')
  return token
}
function receiptPath(object) { return path.join(STATE_DIR, createHash('sha256').update(`${ENGINE}\n${object.key}\n${object.etag}`).digest('hex') + '.json') }
function saveReceipt(object, result, applied) {
  const destination = receiptPath(object); const temporary = destination + '.tmp'
  writeFileSync(temporary, JSON.stringify({ engine: ENGINE, key: object.key, etag: object.etag, result, applied, recorded: new Date().toISOString() }), { mode: 0o600 })
  chmodSync(temporary, 0o600); renameSync(temporary, destination)
}
function cachedResult(object) {
  try {
    const receipt = JSON.parse(readFileSync(receiptPath(object), 'utf8'))
    if (receipt.engine !== ENGINE || receipt.key !== object.key || receipt.etag !== object.etag || receipt.result?.status !== 'ready') return null
    resultStatement(object, null, receipt.result) // validate local receipt limits
    return receipt.result
  } catch { return null }
}
function timeout(promise, ms, label) {
  let timer
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label)), ms) })]).finally(() => clearTimeout(timer))
}

export async function main(args = process.argv.slice(2), dependencies = {}) {
  const options = parseOptions(args)
  const report = dependencies.report ?? console.log
  if (options.help) {
    report('Read-only inventory: node scripts/index-migrated-media.mjs\nLocal OCR proof, no remote writes: --preview-ocr --limit 3\nIndex at most 100 images: --apply --limit 100 --workers 2\nExplicit retry: add --retry-errors. Repeating resumes from real D1 state and ETag-bound local receipts.')
    return
  }
  const cloud = dependencies.cloud ?? createCloudflare(readCredential(), options.apply)
  const inventory = await cloud.inventory()
  const objects = inventory.filter(publicImage).map(o => ({ ...o, etag: safeEtag(o.etag) })).sort((a, b) => a.key.localeCompare(b.key))
  const migrationReady = await cloud.schemaReady()
  if (!migrationReady) {
    report(JSON.stringify({ mode: options.apply ? 'apply' : options.preview ? 'local-ocr-preview' : 'read-only',
      inventory: inventory.length, publicImages: objects.length, migrationReady: false, remoteWrites: 0,
      message: options.preview ? 'Media index migration is missing. Local OCR preview can continue without index records.'
        : 'Media index migration is missing. No remote writes performed; apply the migration before indexing.' }))
    if (options.apply) throw Error('Media index migration is missing; no remote writes performed')
    if (!options.preview) return
  }
  const rows = migrationReady ? await cloud.rows(objects) : new Map()
  const pending = objects.filter(o => needsOcr(o, rows.get(o.key), options.retryErrors))
  const selected = pending.slice(0, options.limit)
  report(JSON.stringify({ mode: options.apply ? 'apply' : options.preview ? 'local-ocr-preview' : 'read-only', inventory: inventory.length,
    publicImages: objects.length, migrationReady, remoteWrites: 0,
    ready: migrationReady ? objects.filter(o => rows.get(o.key)?.etag === o.etag && rows.get(o.key)?.ocr_status === 'ready').length : null,
    errors: migrationReady ? objects.filter(o => rows.get(o.key)?.etag === o.etag && rows.get(o.key)?.ocr_status === 'error').length : null,
    eligible: pending.length, selected: selected.length, remainingAfterBatch: Math.max(0, pending.length - selected.length) }))
  if ((!options.apply && !options.preview) || !selected.length) return
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 }); chmodSync(STATE_DIR, 0o700)
  const lockPath = path.join(STATE_DIR, 'run.lock')
  let lock
  try { lock = openSync(lockPath, 'wx', 0o600); writeFileSync(lock, String(process.pid)) } catch { throw Error('A local backfill lock exists; check its PID before removing run.lock') }
  let next = 0; let stop = false; let fatal = null
  const stats = { completed: 0, recognized: 0, reused: 0, indexed: 0, errors: 0, changed: 0, concurrent: 0 }
  const stopHandler = () => { stop = true }
  process.on('SIGINT', stopHandler); process.on('SIGTERM', stopHandler)
  const run = async workerIndex => {
    let engine
    try {
      while (!stop) {
        const object = selected[next++]; if (!object) break
        let result = cachedResult(object)
        if (result) stats.reused++
        else {
          // API/auth/network errors stop rather than being mislabeled OCR errors.
          const bytes = await cloud.bytes(object)
          if (!engine) {
            let expired = false
            const starting = createWorker('eng', 1, { langPath: path.join(ROOT, 'public/ocr/lang'), cachePath: STATE_DIR, cacheMethod: 'none', errorHandler() {} })
            starting.then(late => { if (expired) void late.terminate() }, () => {})
            try { engine = await timeout(starting, 30_000, 'OCR worker initialization timed out') }
            catch (error) { expired = true; throw error }
          }
          try {
            const bitmap = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error', animated: false })
              .rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).png().toBuffer()
            const output = await timeout(engine.recognize(bitmap), 90_000, 'Image recognition timed out')
            result = { status: 'ready', text: output.data.text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, 100_000), confidence: output.data.confidence, error: null }
            stats.recognized++
          } catch {
            await engine?.terminate(); engine = null
            result = { status: 'error', text: '', confidence: null, error: 'Local pixel OCR failed or exceeded its decoding/time limit. Retry this image explicitly.' }
            stats.errors++
          }
          saveReceipt(object, result, false)
        }
        if (!await cloud.unchanged(object)) stats.changed++
        else if (options.apply) {
          const saved = await cloud.write(object, rows.get(object.key), result)
          if (saved.results?.length) { stats.indexed++; saveReceipt(object, result, true) }
          else stats.concurrent++
        }
        stats.completed++
        if (stats.completed % 5 === 0 || stats.completed === selected.length) report(JSON.stringify({ worker: workerIndex, ...stats, remoteWritesEnabled: options.apply }))
      }
    } catch (error) { stop = true; fatal ??= error }
    finally { await engine?.terminate() }
  }
  try { await Promise.all(Array.from({ length: options.workers }, (_, i) => run(i + 1))) }
  finally {
    process.removeListener('SIGINT', stopHandler); process.removeListener('SIGTERM', stopHandler)
    closeSync(lock); rmSync(lockPath)
    report(JSON.stringify({ finished: !stop, ...stats, remoteWritesEnabled: options.apply }))
  }
  if (fatal) throw fatal
  if (stop) process.exitCode = 130
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  // Fatal initialization may leave a third-party worker awaiting startup.
  // main's finally has already closed our lock and terminated ready workers.
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Media backfill failed'); process.exit(1) })
}
