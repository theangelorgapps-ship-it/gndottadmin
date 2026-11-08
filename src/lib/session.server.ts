import { env } from 'cloudflare:workers'
import { deleteCookie, getRequest, getRequestHeaders } from '@tanstack/react-start/server'
import { getAuth, AUTH_REALM } from './better-auth.server'
import { eligibleUser } from './better-auth-core'
import { sameOrigin } from './authCore'

function protectSessionWrite() {
  const request = getRequest()
  if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request.url, request.headers.get('origin'), request.headers.get('sec-fetch-site'))
}

// Legacy cookies no longer authenticate. Better Auth owns signed, revocable sessions.
export const SESSION_COOKIE = '__Secure-halobox-admin.session_token'
export async function getSession(headers = getRequestHeaders()) {
  protectSessionWrite()
  const result = await getAuth().api.getSession({ headers }).catch(() => null)
  if (!result) return null
  const user = await eligibleUser((env as any).DB, result.user.id, AUTH_REALM)
  if (!user) return null
  return { uid: Number(user.id), email: String(user.email), name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(), pid: (result.session as any).profileId as number | undefined, sessionId: result.session.id }
}
export async function clearSessionCookie() {
  protectSessionWrite()
  await getAuth().api.signOut({ headers: getRequestHeaders() })
  deleteCookie('streamit_session', { path: '/' })
  deleteCookie('halobox_admin_session_20261105', { path: '/' })
}
