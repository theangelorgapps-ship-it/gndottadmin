/** Shared validation for the admin media index and uploads. No client metadata is OCR. */
export const MAX_UPLOAD = 10 * 1024 * 1024
export const MAX_SUBTITLE = 2 * 1024 * 1024
export const MAX_REQUEST = MAX_UPLOAD + 64 * 1024
export const OCR_BATCH_SIZE = 6
// Discovery uses one upsert per object plus at most six fixed D1 queries.
// Twenty objects leave room for session/auth queries within the Free limit.
export const SCAN_BATCH_SIZE = 20
export type MediaKind = 'image' | 'document' | 'subtitle' | 'other'
export type OcrStatus = 'pending' | 'processing' | 'ready' | 'error' | 'unsupported'
export interface MediaAsset {
  key: string; name: string; folder: string; size: number; uploaded: string | null; etag: string
  kind: MediaKind; url: string; ocr_status: OcrStatus; ocr_text: string; ocr_error: string | null; confidence: number | null
}
export type MediaFilters = { kind?: MediaKind | ''; query?: string; mode?: 'text' | 'filename'; folder?: string; from?: string; to?: string; offset?: number }
export class MediaError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function publicMediaKey(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 1024 || /[\\%\x00-\x1f\x7f?#]/.test(value)) return false
  const parts = value.split('/')
  return !parts.some(p => !p || p === '.' || p === '..') && parts[0].toLowerCase() !== 'private'
}
export function requireMediaKey(value: unknown): string {
  if (!publicMediaKey(value)) throw new MediaError(400, 'Invalid public media key.')
  return value
}
export function mediaUrl(key: string) { return '/media/' + requireMediaKey(key).split('/').map(encodeURIComponent).join('/') }
export function mediaKind(key: string): MediaKind {
  if (/\.(avif|jpe?g|png|webp|gif|bmp)$/i.test(key)) return 'image'
  if (/\.pdf$/i.test(key)) return 'document'
  if (/\.(vtt|srt)$/i.test(key)) return 'subtitle'
  return 'other'
}
export function assetFolder(key: string) { return key.includes('/') ? key.split('/')[0] : 'Unsorted' }
export function validFilters(value: MediaFilters = {}): Required<MediaFilters> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MediaError(400, 'Invalid search.')
  const { kind = '', query = '', mode = 'text', folder = '', from = '', to = '', offset = 0 } = value
  if (!['', 'image', 'document', 'subtitle', 'other'].includes(kind)) throw new MediaError(400, 'Choose a valid media type.')
  if (typeof query !== 'string' || query.length > 160 || !['text', 'filename'].includes(mode)) throw new MediaError(400, 'Invalid search.')
  if (typeof folder !== 'string' || folder.length > 200 || /[\x00-\x1f]/.test(folder)) throw new MediaError(400, 'Invalid folder.')
  for (const date of [from, to]) {
    if (typeof date !== 'string') throw new MediaError(400, 'Choose a valid date.')
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new MediaError(400, 'Choose a valid date.')
  }
  if (from && to && from > to) throw new MediaError(400, 'The end date must follow the start date.')
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new MediaError(400, 'Invalid page.')
  return { kind, query: query.trim(), mode, folder, from, to, offset }
}
export function sqlLike(value: string) { return value.replace(/[\\%_]/g, '\\$&') }
export function assertMediaOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new MediaError(403, 'Refresh this page before trying again.')
}
export async function boundedBytes(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array> {
  if (!stream) throw new MediaError(400, 'No file was received.')
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new MediaError(413, 'File too large (maximum 10 MB).') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}
export function imageSignature(bytes: Uint8Array): string | null {
  const b = bytes; const ascii = (start: number, end: number) => String.fromCharCode(...b.slice(start, end))
  if (b.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)) return 'png'
  if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpg'
  if (b.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP') return 'webp'
  if (b.length >= 6 && ['GIF87a','GIF89a'].includes(ascii(0,6))) return 'gif'
  if (b.length >= 24 && ascii(4,8) === 'ftyp') {
    const boxSize = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0)
    if (boxSize < 16 || boxSize > b.length || boxSize > 256) return null
    for (let p = 8; p + 4 <= boxSize; p += 4) if (p !== 12 && ['avif','avis'].includes(ascii(p,p+4))) return 'avif'
  }
  return null
}
export function classifyUpload(name: string, bytes: Uint8Array): { ext: string; type: string; kind: MediaKind } {
  if (!bytes.length) throw new MediaError(400, 'The file is empty.')
  if (bytes.length > MAX_UPLOAD) throw new MediaError(413, 'File too large (maximum 10 MB).')
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const image = imageSignature(bytes)
  if (['jpg','jpeg','png','webp','gif','avif'].includes(ext)) {
    if (!image || (ext === 'jpeg' ? 'jpg' : ext) !== image) throw new MediaError(415, 'The image contents do not match its file type.')
    return { ext: image, type: `image/${image === 'jpg' ? 'jpeg' : image}`, kind: 'image' }
  }
  if (ext === 'pdf') {
    const start = new TextDecoder().decode(bytes.slice(0,8)); const end = new TextDecoder().decode(bytes.slice(-1024))
    if (!/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(start) || !end.includes('%%EOF')) throw new MediaError(415, 'This is not a valid PDF document.')
    return { ext, type: 'application/pdf', kind: 'document' }
  }
  if (ext === 'vtt' || ext === 'srt') {
    if (bytes.length > MAX_SUBTITLE) throw new MediaError(413, 'Subtitles must be smaller than 2 MB.')
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new MediaError(415, 'Subtitles must use UTF-8 text.') }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) || /<\s*(script|iframe|object|embed|svg|html)\b/i.test(text)) throw new MediaError(415, 'Unsupported content in subtitle file.')
    if (ext === 'vtt' ? !/^\uFEFF?WEBVTT(?:[\t ]|\r?\n|$)/.test(text) : !/\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(text)) throw new MediaError(415, 'The subtitle format is invalid.')
    return { ext, type: ext === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8', kind: 'subtitle' }
  }
  throw new MediaError(415, 'Choose a JPG, PNG, WebP, GIF, AVIF, PDF, VTT or SRT file. Upload videos with Bunny Stream.')
}
export function cleanOcrResult(value: { text?: string; confidence?: number; error?: string }) {
  if (value.error) return { text: '', confidence: null, error: String(value.error).slice(0, 300), status: 'error' as const }
  if (typeof value.text !== 'string' || value.text.length > 100_000 || !Number.isFinite(value.confidence) || Number(value.confidence) < 0 || Number(value.confidence) > 100) throw new MediaError(400, 'Invalid OCR result.')
  return { text: value.text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim(), confidence: Number(value.confidence), error: null, status: 'ready' as const }
}
