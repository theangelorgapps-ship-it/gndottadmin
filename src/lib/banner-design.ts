export const HERO_DEVICES = ['phone', 'tablet', 'web', 'app'] as const
export type HeroDevice = typeof HERO_DEVICES[number]
export type HeroFrame = { image?: string; x: number; y: number; fit: 'cover' | 'contain'; align: 'left' | 'center' | 'right' }
export type HeroDesign = { version: 1; devices: Partial<Record<HeroDevice, HeroFrame>> }
export const defaultFrame = (): HeroFrame => ({ x: 50, y: 50, fit: 'cover', align: 'center' })
export function safeArtworkUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Choose a valid image URL.')
  const url = value.trim()
  if (!url) return ''
  if (/^\/media\/[a-zA-Z0-9_./-]+$/.test(url) && !url.includes('..')) return url
  try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href } catch {}
  throw new Error('Image must use HTTPS or the media library.')
}
export function validateHeroDesign(value: unknown): HeroDesign {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid hero design.')
  const v = value as any
  if (v.version !== 1 || !v.devices || typeof v.devices !== 'object' || Array.isArray(v.devices)) throw new Error('Invalid hero design version.')
  const devices: HeroDesign['devices'] = {}
  for (const [key, frame] of Object.entries(v.devices)) {
    if (!HERO_DEVICES.includes(key as HeroDevice) || !frame || typeof frame !== 'object') throw new Error('Unknown hero device.')
    const f = frame as any
    if (!Number.isFinite(f.x) || f.x < 0 || f.x > 100 || !Number.isFinite(f.y) || f.y < 0 || f.y > 100) throw new Error('Image position must be between 0 and 100.')
    if (!['cover', 'contain'].includes(f.fit) || !['left', 'center', 'right'].includes(f.align)) throw new Error('Choose a valid image fit and text alignment.')
    devices[key as HeroDevice] = { image: safeArtworkUrl(f.image ?? ''), x: f.x, y: f.y, fit: f.fit, align: f.align }
  }
  return { version: 1, devices }
}

/** Empty overrides deliberately follow the selected title, including future artwork changes. */
export function heroArtwork(device: HeroDevice, banner: { file_url?: string; poster_url?: string; design_json?: string }, title?: { poster_url?: string; thumbnail_url?: string }): string {
  if (banner.design_json) {
    try { const override = validateHeroDesign(JSON.parse(banner.design_json)).devices[device]?.image; if (override) return override } catch { /* Invalid legacy layout falls back to title artwork. */ }
  }
  return device === 'phone' || device === 'app'
    ? banner.poster_url || title?.poster_url || banner.file_url || title?.thumbnail_url || ''
    : banner.file_url || title?.thumbnail_url || title?.poster_url || banner.poster_url || ''
}
