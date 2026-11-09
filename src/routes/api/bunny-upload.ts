import { createFileRoute } from '@tanstack/react-router'
import { getSession } from '../../lib/session.server'
import { first, run } from '../../lib/db'
import { activeAccount, sameOrigin } from '../../lib/authCore'

const MAX_VIDEO_BYTES = 500 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_VIDEO_BYTES + 64 * 1024
const TABLES = new Set(['entertainments', 'episodes', 'videos'])
class BunnyUploadError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
const failure = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } })

async function requireAdminUser(request: Request) {
  const session = await getSession(request.headers)
  if (!session?.uid) return null
  const user = await first<any>(`SELECT user_type, status, is_banned, deleted_at FROM users WHERE id = ? AND user_type = 'admin' AND status = 1 AND is_banned = 0 AND deleted_at IS NULL`, session.uid)
  return user?.user_type === 'admin' && activeAccount(user) ? session : null
}

async function bunnyConfig() {
  const lib = await first<any>(`SELECT val FROM settings WHERE name = 'bunny_library_id'`)
  const key = await first<any>(`SELECT val FROM settings WHERE name = 'bunny_api_key'`)
  const libraryId = String(lib?.val ?? '').trim()
  const apiKey = String(key?.val ?? '').trim()
  if (!/^\d+$/.test(libraryId) || !apiKey || /[\r\n]/.test(apiKey)) throw new BunnyUploadError(400, 'Bunny Stream is not configured. Set the Library ID and API Key in Settings → Bunny Stream.')
  return { libraryId, apiKey }
}

export async function validateBunnyForm(form: FormData) {
  const file = form.get('file')
  if (!(file instanceof File) || form.getAll('file').length !== 1) throw new BunnyUploadError(400, 'Choose one video file.')
  if (file.size === 0) throw new BunnyUploadError(400, 'The video file is empty.')
  if (file.size > MAX_VIDEO_BYTES) throw new BunnyUploadError(413, 'File too large (maximum 500 MB).')
  const rawTitle = form.get('title')
  const rawTable = form.get('table')
  const rawRowId = form.get('row_id')
  for (const [name, value] of [['title', rawTitle], ['table', rawTable], ['row_id', rawRowId]] as const) {
    if (value !== null && (typeof value !== 'string' || form.getAll(name).length !== 1)) throw new BunnyUploadError(400, `Invalid ${name}.`)
  }
  const title = (typeof rawTitle === 'string' ? rawTitle.trim() : '') || file.name
  if (title.length > 250 || /[\x00-\x1f\x7f]/.test(title)) throw new BunnyUploadError(400, 'Use a video title of at most 250 characters without control characters.')
  const table = typeof rawTable === 'string' ? rawTable : ''
  if (table && !TABLES.has(table)) throw new BunnyUploadError(400, 'Invalid content destination.')
  // Unsaved editors send a valid table with no row ID. They attach the returned ID on Save.
  const rowId = rawRowId === null || rawRowId === '' ? null : Number(rawRowId)
  if (rowId !== null && (!table || typeof rawRowId !== 'string' || !/^\d+$/.test(rawRowId) || !Number.isSafeInteger(rowId) || rowId < 1)) throw new BunnyUploadError(400, 'Choose an existing content record.')

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedTypes: Record<string, string[]> = {
    mp4: ['video/mp4'], m4v: ['video/mp4', 'video/x-m4v'], mov: ['video/quicktime'],
    webm: ['video/webm'], mkv: ['video/x-matroska'], avi: ['video/x-msvideo', 'video/avi'],
  }
  const mime = file.type.toLowerCase().split(';')[0]
  if (!allowedTypes[extension] || (mime && mime !== 'application/octet-stream' && !allowedTypes[extension].includes(mime))) throw new BunnyUploadError(415, 'Choose an MP4, MOV, M4V, WebM, MKV or AVI video.')
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  const valid = ['mp4', 'mov', 'm4v'].includes(extension)
    ? bytes.length >= 12 && ['ftyp', 'moov', 'mdat', 'wide'].includes(ascii(4, 8)) && !['avif', 'avis', 'heic', 'heix', 'mif1', 'msf1'].includes(ascii(8, 12))
    : ['webm', 'mkv'].includes(extension)
      ? bytes.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((value, index) => bytes[index] === value)
      : bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'AVI '
  if (!valid) throw new BunnyUploadError(415, 'The file contents do not match a supported video format.')
  return { file, title, table, rowId }
}

async function readUploadForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data;/i.test(contentType)) throw new BunnyUploadError(415, 'Upload a video using the file picker.')
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) throw new BunnyUploadError(413, 'File too large (maximum 500 MB).')
  if (!request.body) throw new BunnyUploadError(400, 'Choose a video file.')
  let received = 0
  const bounded = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength
      if (received > MAX_REQUEST_BYTES) throw new BunnyUploadError(413, 'File too large (maximum 500 MB).')
      controller.enqueue(chunk)
    },
  }))
  try { return await new Response(bounded, { headers: { 'content-type': contentType } }).formData() }
  catch (error) {
    if (error instanceof BunnyUploadError) throw error
    throw new BunnyUploadError(400, 'The upload could not be read.')
  }
}

export async function handleBunnyUpload(request: Request) {
  // Check CSRF before session lookup, request parsing, database writes or remote requests.
  try { sameOrigin(request.url, request.headers.get('origin'), request.headers.get('sec-fetch-site')) }
  catch { return failure(403, 'Refresh this page before uploading.') }
  try {
    const session = await requireAdminUser(request)
    if (!session) return failure(403, 'An active administrator account is required.')
    const { file, title, table, rowId } = await validateBunnyForm(await readUploadForm(request))
    if (rowId !== null && !await first(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`, rowId)) throw new BunnyUploadError(404, 'The content record is no longer available.')
    const { libraryId, apiKey } = await bunnyConfig()

    const createResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST', headers: { AccessKey: apiKey, 'Content-Type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ title }),
    })
    if (!createResponse.ok) throw new BunnyUploadError(502, `Bunny could not create the video (${createResponse.status}).`)
    const created: any = await createResponse.json().catch(() => null)
    const guid = created?.guid
    if (typeof guid !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(guid)) throw new BunnyUploadError(502, 'Bunny did not return a valid video ID.')
    const uploadResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
      method: 'PUT', headers: { AccessKey: apiKey, 'Content-Type': 'application/octet-stream' }, body: file.stream(),
    })
    if (!uploadResponse.ok) throw new BunnyUploadError(502, `Bunny could not save the video (${uploadResponse.status}).`)

    let attached = false
    if (rowId !== null) {
      try {
        const result = await run(`UPDATE ${table} SET bunny_video_url = ?, video_upload_type = 'bunny', updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`, guid, rowId)
        attached = result?.success !== false && Number(result?.meta?.changes ?? 1) > 0
      } catch { attached = false }
    }
    // Always return the uploaded ID so the editor can save it, including if an attachment raced deletion.
    return Response.json({ ok: true, videoId: guid, embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}`, attached }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return error instanceof BunnyUploadError ? failure(error.status, error.message) : failure(503, 'Video upload is temporarily unavailable. Please try again.')
  }
}

export const Route = createFileRoute('/api/bunny-upload')({
  server: { handlers: { POST: ({ request }) => handleBunnyUpload(request) } },
})
