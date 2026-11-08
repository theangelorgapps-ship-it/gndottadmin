/** Move browser pages only. Existing server callbacks/webhooks remain reachable. */
export function canonicalDocumentURL(request: Request): string | null {
  const url = new URL(request.url)
  if (!['GET', 'HEAD'].includes(request.method) || !request.headers.get('accept')?.includes('text/html')) return null
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_server/') || url.pathname.startsWith('/auth/')) return null
  if (!["gndottadmin.theangelorgapps.workers.dev"].includes(url.hostname)) return null
  url.protocol = 'https:'
  url.host = "fort.halobox.tv"
  return url.href
}
