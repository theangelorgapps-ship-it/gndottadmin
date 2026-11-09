import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { isPublicMediaKey } from '../../lib/account-media.server'

type MediaMetadata = { contentType?: string; contentDisposition?: string }

export function publicMediaHeaders(key: string, metadata?: MediaMetadata): Headers {
  const suppliedType = metadata?.contentType ?? ''
  const contentType = /^[\w.+-]+\/[\w.+-]+(?:;\s*charset=utf-8)?$/i.test(suppliedType) ? suppliedType : 'application/octet-stream'
  const mime = contentType.split(';')[0].toLowerCase()
  // SVG and HTML can execute scripts when opened directly; only raster images are passive.
  const passiveImage = /^image\/(?:avif|jpeg|png|webp|gif|bmp|x-icon|vnd\.microsoft\.icon)$/.test(mime)
  const inlineMedia = /^(?:video|audio)\//.test(mime) || ['text/vtt', 'application/x-subrip'].includes(mime)
  const attachment = mime === 'application/pdf' || (!passiveImage && !inlineMedia)
  const stored = metadata?.contentDisposition ?? ''
  const disposition = stored.length <= 512 && /^[\x20-\x7e]*$/.test(stored) && /^(?:inline|attachment)(?:;.*)?$/i.test(stored) ? stored : ''
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  if (!passiveImage) headers.set('content-security-policy', "default-src 'none'; sandbox")
  if (attachment) {
    const parameters = disposition.includes(';') ? disposition.slice(disposition.indexOf(';')) : `; filename="${(key.split('/').pop() ?? 'download').replace(/[^a-zA-Z0-9._ ()-]/g, '_').slice(0, 150)}"`
    headers.set('content-disposition', `attachment${parameters}`)
  } else if (disposition) headers.set('content-disposition', disposition)
  return headers
}

export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = (params as any)._splat ?? (params as any)['*']
        if (!isPublicMediaKey(key) || key.length > 1024 || /[\x00-\x1f\x7f?#]/.test(key)) return new Response('not found', { status: 404 })
        const obj = await (env as any).MEDIA.get(key)
        if (!obj) return new Response('not found', { status: 404 })
        return new Response(obj.body, { headers: publicMediaHeaders(key, obj.httpMetadata) })
      },
    },
  },
})
