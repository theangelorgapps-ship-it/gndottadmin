export type LocationAssignment = { content_type: 'entertainment' | 'video' | 'episode'; content_id: number }
export type LocationInput = { id?: number; name: string; file_url?: string | null; description?: string | null; address?: string | null; status: number; assignments: LocationAssignment[] }

export function positiveId(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('A valid record ID is required.')
  return Number(value)
}

export function validateLocation(input: LocationInput): LocationInput {
  if (!input || typeof input !== 'object') throw new Error('Location details are required.')
  if (input.id !== undefined) positiveId(input.id)
  const text = (value: unknown, max: number) => {
    if (value == null || value === '') return null
    if (typeof value !== 'string' || value.trim().length > max) throw new Error(`Text must be at most ${max} characters.`)
    return value.trim() || null
  }
  const name = text(input.name, 200)
  if (!name) throw new Error('Location name is required.')
  const file_url = text(input.file_url, 2048)
  if (file_url && !/^\/(?!\/)/.test(file_url) && !/^https:\/\/[^\s]+$/i.test(file_url)) throw new Error('Use an HTTPS image URL or a local media path.')
  if (![0, 1].includes(input.status)) throw new Error('Status must be active or inactive.')
  if (!Array.isArray(input.assignments) || input.assignments.length > 500) throw new Error('Choose up to 500 titles.')
  const unique = new Map<string, LocationAssignment>()
  for (const assignment of input.assignments) {
    if (!assignment || !['entertainment', 'video', 'episode'].includes(assignment.content_type)) throw new Error('Unknown title type.')
    positiveId(assignment.content_id)
    unique.set(`${assignment.content_type}:${assignment.content_id}`, { content_type: assignment.content_type, content_id: assignment.content_id })
  }
  return { id: input.id, name, file_url, description: text(input.description, 5000), address: text(input.address, 1000), status: input.status, assignments: [...unique.values()] }
}

export function validatePersonalitySocials(values: Record<string, unknown>) {
  const hosts: Record<string, string[]> = { facebook: ['facebook.com', 'www.facebook.com'], instagram: ['instagram.com', 'www.instagram.com'], x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'] }
  const links: { provider: string; url: string | null }[] = []
  for (const provider of ['facebook', 'instagram', 'x', 'website']) {
    const key = `social_${provider}`
    if (!(key in values)) continue
    const value = values[key]
    if (value == null || value === '') { links.push({ provider, url: null }); continue }
    if (typeof value !== 'string' || value.length > 2048) throw new Error(`Invalid ${provider} URL.`)
    let url: URL
    try { url = new URL(value.trim()) } catch { throw new Error(`Enter a complete ${provider} URL.`) }
    if (url.protocol !== 'https:' || url.username || url.password || (provider !== 'website' && !hosts[provider].includes(url.hostname))) throw new Error(`Use the official HTTPS ${provider} URL.`)
    links.push({ provider, url: url.href })
  }
  return links
}
