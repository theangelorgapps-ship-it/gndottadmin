import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getSession } from '../../../lib/session.server'
import { first } from '../../../lib/db'
import { serveAccountMedia } from '../../../lib/account-media.server'

export const Route = createFileRoute('/api/account-media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const session = await getSession()
        const key = (params as any)._splat ?? (params as any)['*']
        return serveAccountMedia(key, session?.uid, first, (env as any).MEDIA, true)
      },
    },
  },
})
