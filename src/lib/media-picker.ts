import type { MediaAsset, MediaKind } from './media-library-core'

/** Resolve the library filter from the same accept contract used by the file picker. */
export function pickerKind(accept = ''): MediaKind | '' {
  const types = accept.toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
  if (types.length && types.every(value => value.startsWith('image/') || /^\.(avif|jpe?g|png|webp|gif|bmp)$/.test(value))) return 'image'
  if (types.length && types.every(value => /^(\.pdf|application\/pdf)$/.test(value))) return 'document'
  if (types.length && types.every(value => /^(\.(vtt|srt)|text\/vtt|application\/x-subrip)$/.test(value))) return 'subtitle'
  return ''
}

export function acceptsMedia(asset: Pick<MediaAsset, 'key' | 'kind'>, accept = '') {
  if (!accept) return true
  const extension = '.' + (asset.key.split('.').pop()?.toLowerCase() ?? '')
  return accept.toLowerCase().split(',').some(raw => {
    const value = raw.trim()
    return value === '*/*' || value === extension || (value === 'image/*' && asset.kind === 'image') ||
      (value === 'application/pdf' && extension === '.pdf') || (value === 'text/vtt' && extension === '.vtt') ||
      (value === 'application/x-subrip' && extension === '.srt') ||
      (value.startsWith('image/') && value.slice(6).replace('jpeg', 'jpg') === extension.slice(1).replace('jpeg', 'jpg'))
  })
}
