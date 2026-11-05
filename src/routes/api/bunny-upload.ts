import { createFileRoute } from '@tanstack/react-router'
import { verifySessionToken, SESSION_COOKIE } from '../../lib/session.server'
import { first, run } from '../../lib/db'

async function requireAdminUser(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const raw = cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(SESSION_COOKIE + '='))
    ?.slice(SESSION_COOKIE.length + 1)
  const session = await verifySessionToken(raw ? decodeURIComponent(raw) : undefined)
  if (!session?.uid) return null
  const user = await first<any>(`SELECT user_type FROM users WHERE id = ?`, session.uid)
  return user?.user_type === 'admin' ? session : null
}

async function bunnyConfig() {
  const lib = await first<any>(`SELECT val FROM settings WHERE name = 'bunny_library_id'`).catch(() => null)
  const key = await first<any>(`SELECT val FROM settings WHERE name = 'bunny_api_key'`).catch(() => null)
  return { libraryId: lib?.val ? String(lib.val) : null, apiKey: key?.val ? String(key.val) : null }
}

export const Route = createFileRoute('/api/bunny-upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await requireAdminUser(request)
        if (!session) return Response.json({ error: 'forbidden' }, { status: 403 })
        const { libraryId, apiKey } = await bunnyConfig()
        if (!libraryId || !apiKey)
          return Response.json(
            { error: 'Bunny Stream is not configured. Set the Library ID and API Key in Settings → Bunny Stream.' },
            { status: 400 },
          )

        const form = await request.formData()
        const file = form.get('file') as File | null
        const title = String(form.get('title') || file?.name || 'Untitled')
        const table = String(form.get('table') || '')
        const rowId = Number(form.get('row_id') || 0)
        if (!file) return Response.json({ error: 'no file' }, { status: 400 })
        if (file.size > 500 * 1024 * 1024) return Response.json({ error: 'file too large (max 500 MB)' }, { status: 413 })

        // 1. create the video object in the Bunny library
        const createResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
          method: 'POST',
          headers: { AccessKey: apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ title }),
        })
        if (!createResp.ok)
          return Response.json({ error: `Bunny create failed (${createResp.status}): ${(await createResp.text()).slice(0, 300)}` }, { status: 502 })
        const created: any = await createResp.json()
        const guid = created?.guid
        if (!guid) return Response.json({ error: 'Bunny did not return a video id.' }, { status: 502 })

        // 2. upload the binary
        const putResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
          method: 'PUT',
          headers: { AccessKey: apiKey, 'Content-Type': 'application/octet-stream' },
          body: await file.arrayBuffer(),
        })
        if (!putResp.ok)
          return Response.json({ error: `Bunny upload failed (${putResp.status}): ${(await putResp.text()).slice(0, 300)}` }, { status: 502 })

        // 3. optionally attach the video id to a content row
        const allowedTables = ['entertainments', 'episodes', 'videos']
        if (rowId && allowedTables.includes(table)) {
          await run(
            `UPDATE ${table} SET bunny_video_url = ?, video_upload_type = 'bunny', updated_at = datetime('now') WHERE id = ?`,
            guid, rowId,
          ).catch(() => null)
        }

        return Response.json({ ok: true, videoId: guid, embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}` })
      },
    },
  },
})
