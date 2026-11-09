import sanitizeHtml from 'sanitize-html'

/** Persist navigation links only; executable, credential-bearing and ambiguous URLs are rejected. */
export function safeContentLink(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string' && value.length <= 2048 && !/[\u0000-\u001f\u007f\\]/.test(value)) {
    const link = value.trim()
    if (!link) return null
    if (/^\/(?!\/)/.test(link)) return link
    try {
      const url = new URL(link)
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href
    } catch { /* Report the field error below. */ }
  }
  throw new Error('Use an HTTPS URL or a website path beginning with /.')
}

/** One HTML policy for editor input and persisted content. Never allow executable or embedded content. */
export function sanitizeContentHtml(value: unknown): string {
  if (value == null) return ''
  if (typeof value !== 'string') throw new Error('Content must be text.')
  if (value.length > 200_000) throw new Error('Keep content below 200,000 characters.')
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'hr', 'a'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  })
}

export function richTextHasContent(value: unknown) {
  return sanitizeHtml(sanitizeContentHtml(value), { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s/g, '').length > 0
}

/** Only fields whose stored contract is HTML use the rich editor/sanitizer. */
export const RICH_TEXT_FIELDS: Record<string, readonly string[]> = {
  pages: ['description'], faq: ['answer'], seasons: ['description'], series: ['description'], 'teaching-volumes': ['description'],
  episodes: ['description'], 'teaching-episodes': ['description'],
}
