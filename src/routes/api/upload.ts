import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getSession } from '../../lib/session.server'
import { first } from '../../lib/db'

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request.headers)
        if (!session?.uid) return Response.json({ error: 'unauthorized' }, { status: 401 })
        const user = await first<any>(`SELECT user_type FROM users WHERE id = ?`, session.uid)
        if (user?.user_type !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 })

        const form = await request.formData()
        const file = form.get('file') as File | null
        if (!file) return Response.json({ error: 'no file' }, { status: 400 })
        if (file.size > 10 * 1024 * 1024) return Response.json({ error: 'file too large (max 10 MB)' }, { status: 413 })
        const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'webm']
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        if (!allowed.includes(ext)) return Response.json({ error: `unsupported file type: .${ext}` }, { status: 415 })

        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        await (env as any).MEDIA.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || 'application/octet-stream' },
        })
        return Response.json({ ok: true, url: `/media/${key}` })
      },
    },
  },
})
