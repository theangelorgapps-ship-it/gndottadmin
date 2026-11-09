import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '../../lib/admin'
import { assertMediaOrigin, boundedBytes, MAX_REQUEST, MAX_UPLOAD, MediaError } from '../../lib/media-library-core'
import { mediaRateLimit, storeMediaUpload } from '../../lib/media-library.server'

export async function handleMediaUpload(request: Request) {
  try {
    assertMediaOrigin(request)
    const user = await requireAdmin()
    await mediaRateLimit(user.uid, 'upload', 12)
    const length = Number(request.headers.get('content-length'))
    if (Number.isFinite(length) && length > MAX_REQUEST) throw new MediaError(413, 'File too large (maximum 10 MB).')
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.startsWith('multipart/form-data;')) throw new MediaError(415, 'Upload a file using the file picker.')
    // Bound the whole multipart body before formData parses it, including chunked requests.
    const body = await boundedBytes(request.body, MAX_REQUEST)
    let form: FormData
    try { form = await new Response(body.buffer as ArrayBuffer, { headers: { 'content-type': contentType } }).formData() } catch { throw new MediaError(400, 'The upload could not be read.') }
    const file = form.get('file')
    if (!(file instanceof File) || form.getAll('file').length !== 1) throw new MediaError(400, 'Choose one file to upload.')
    if (file.size > MAX_UPLOAD) throw new MediaError(413, 'File too large (maximum 10 MB).')
    return Response.json(await storeMediaUpload(file, user.uid), { headers: { 'cache-control': 'no-store' } })
  } catch (error: any) {
    const status = error instanceof MediaError ? error.status : error?.code === 'needsAuth' ? 401 : error?.code === 'forbidden' ? 403 : 503
    const message = error instanceof MediaError ? error.message : status === 401 ? 'Sign in before uploading.' : status === 403 ? 'An active administrator account is required.' : 'Upload is temporarily unavailable. Please try again later.'
    return Response.json({ ok: false, error: message }, { status, headers: { 'cache-control': 'no-store' } })
  }
}
export const Route = createFileRoute('/api/upload')({ server: { handlers: { POST: ({ request }) => handleMediaUpload(request) } } })
