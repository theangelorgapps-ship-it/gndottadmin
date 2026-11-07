type Query = (sql: string, ...args: any[]) => Promise<any>
type Bucket = { get(key: string): Promise<any> }

export function isPublicMediaKey(key: unknown): key is string {
  if (typeof key !== 'string' || !key || key.includes('\\') || key.includes('%')) return false
  const parts = key.split('/')
  return !parts.some(p => !p || p === '.' || p === '..') && parts[0].toLowerCase() !== 'private'
}

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', ico: 'image/x-icon', avif: 'image/avif', heic: 'image/heic',
}
const PRIVATE_HEADERS = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
const missing = () => new Response('not found', { status: 404, headers: PRIVATE_HEADERS })

export async function serveAccountMedia(key: unknown, uid: number | undefined, query: Query, bucket: Bucket, allowAdmin = false) {
  if (!Number.isSafeInteger(uid) || Number(uid) <= 0) return new Response('sign in required', { status: 401, headers: PRIVATE_HEADERS })
  if (typeof key !== 'string' || !/^legacy-20261105\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|gif|ico|avif|heic)$/.test(key)) return missing()
  const url = '/api/account-media/' + key
  const owner = await query(
    `SELECT id FROM users WHERE id = ? AND file_url = ? AND deleted_at IS NULL
     UNION ALL SELECT user_id AS id FROM user_multi_profiles WHERE user_id = ? AND avatar = ? AND deleted_at IS NULL LIMIT 1`,
    uid, url, uid, url,
  )
  const admin = !owner && allowAdmin
    ? await query(`SELECT id FROM users WHERE id = ? AND user_type = 'admin' AND status = 1 AND is_banned = 0 AND deleted_at IS NULL`, uid)
    : null
  if (!owner && !admin) return missing()
  const object = await bucket.get('private/' + key)
  if (!object) return missing()
  const extension = key.split('.').pop()!
  return new Response(object.body, {
    headers: {
      ...PRIVATE_HEADERS,
      'content-type': TYPES[extension],
      'content-security-policy': "default-src 'none'; sandbox",
    },
  })
}
