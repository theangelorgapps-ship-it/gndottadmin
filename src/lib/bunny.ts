export type BunnyReference = { videoId: string; libraryId: string | null; source: 'id' | 'embed' | 'hls' }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_RE = new RegExp(`^${UUID}$`, 'i')
// This source library and the typo alias were verified against Bunny before migration.
const CDN_LIBRARIES: Record<string, string> = {
  'vz-71678b8b-6af.b-cdn.net': '347005',
  'avz-71678b8b-6af.b-cdn.net': '347005',
}

function libraryId(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return /^[1-9]\d{0,14}$/.test(text) ? text : null
}

function iframeSource(value: string): string | null {
  if (/<(?:script|object|embed)\b|\bsrcdoc\s*=/i.test(value)) return null
  const tags = value.match(/<iframe\b[^>]*>/gi)
  if (!tags || tags.length !== 1) return null
  const sources = [...tags[0].matchAll(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/gi)]
  if (sources.length !== 1) return null
  // Decode attribute entities as text. Never inject or execute supplied markup.
  return (sources[0][1] ?? sources[0][2] ?? sources[0][3])
    .replace(/&amp;|&#0*38;|&#x0*26;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&apos;|&#0*39;/gi, "'")
}

export function parseBunnyVideo(value: unknown, options: { libraryId?: unknown; allowBareId?: boolean } = {}): BunnyReference | null {
  if (typeof value !== 'string') return null
  let input = value.trim()
  if (!input || input.length > 16384) return null
  if (options.allowBareId && UUID_RE.test(input)) {
    return { videoId: input.toLowerCase(), libraryId: libraryId(options.libraryId), source: 'id' }
  }
  if (input.includes('<')) {
    const src = iframeSource(input)
    if (!src) return null
    input = src.trim()
  }
  try {
    const url = new URL(input.startsWith('//') ? `https:${input}` : input)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (url.hostname === 'iframe.mediadelivery.net') {
      const match = url.pathname.match(new RegExp(`^/(?:embed|play)/([1-9]\\d{0,14})/(${UUID})/?$`, 'i'))
      return match ? { videoId: match[2].toLowerCase(), libraryId: match[1], source: 'embed' } : null
    }
    const knownLibrary = CDN_LIBRARIES[url.hostname]
    if (!knownLibrary) return null
    const match = url.pathname.match(new RegExp(`^/(${UUID})/playlist\\.m3u8$`, 'i'))
    return match ? { videoId: match[1].toLowerCase(), libraryId: knownLibrary, source: 'hls' } : null
  } catch {
    return null
  }
}

export function directVideoUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 16384) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || !/\.(mp4|webm|m4v|ogg)$/i.test(url.pathname)) return null
    return url.href
  } catch {
    return null
  }
}

export type VideoSource = { bunny_video_url?: unknown; video_url_input?: unknown }
export type Playback = { kind: 'bunny'; videoId: string; libraryId: string; url: string } | { kind: 'file'; url: string }

export function resolveVideoPlayback(record: VideoSource, fallbackLibraryId?: unknown): Playback | null {
  const explicit = parseBunnyVideo(record.bunny_video_url, { libraryId: fallbackLibraryId, allowBareId: true })
  const source = parseBunnyVideo(record.video_url_input, { libraryId: fallbackLibraryId })
  // A matching original URL retains its own library provenance after an import extracts the ID.
  const bunny = explicit?.source === 'id' && source?.videoId === explicit.videoId ? source : explicit ?? source
  const selectedLibrary = bunny?.libraryId ?? libraryId(fallbackLibraryId)
  if (bunny && selectedLibrary) {
    return { kind: 'bunny', videoId: bunny.videoId, libraryId: selectedLibrary, url: `https://iframe.mediadelivery.net/embed/${selectedLibrary}/${bunny.videoId}?autoplay=true&preload=false` }
  }
  const file = directVideoUrl(record.video_url_input)
  return file ? { kind: 'file', url: file } : null
}

export function normalizeBunnyFields<T extends Record<string, any>>(values: T): T {
  const out: Record<string, any> = { ...values }
  const supplied = typeof out.bunny_video_url === 'string' ? out.bunny_video_url.trim() : ''
  const explicit = parseBunnyVideo(supplied, { allowBareId: true })
  const source = parseBunnyVideo(out.video_url_input)
  if (supplied && !explicit) throw new Error('Use a valid Bunny video ID, link, or iframe embed.')
  const parsed = explicit ?? source
  if (parsed) {
    out.bunny_video_url = parsed.videoId
    out.video_upload_type = 'bunny'
    // An explicit new embed replaces the video; import never calls this edit helper.
    if (explicit && explicit.source !== 'id' && (!source || source.videoId !== explicit.videoId || source.libraryId !== explicit.libraryId)) out.video_url_input = supplied
  }
  return out as T
}

export function selectedEpisode<T extends { id: number | string }>(episodes: T[], selectedId: number | null): T | null {
  return episodes.find(episode => Number(episode.id) === selectedId) ?? episodes[0] ?? null
}
