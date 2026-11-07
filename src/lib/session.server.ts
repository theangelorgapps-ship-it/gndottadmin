import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { first } from './db'

export const SESSION_COOKIE = 'halobox_admin_session_20261105'
const SESSION_AUDIENCE = 'halobox-admin'
const LEGACY_SESSION_COOKIE = 'streamit_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const SESSION_VERSION = 1

type SessionInput = { uid: number; email: string; name: string }
type Session = SessionInput & { v: number; aud: string; iat: number; exp: number }

async function signingKey() {
  const secret = (env as { SESSION_SECRET?: string }).SESSION_SECRET
  if (typeof secret !== 'string' || new TextEncoder().encode(secret.trim()).length < 32) {
    throw new Error('Session signing is not configured.')
  }
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  )
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid session encoding.')
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function sign(payload: SessionInput): Promise<string> {
  if (!Number.isSafeInteger(payload.uid) || payload.uid < 1) throw new Error('Invalid session user.')
  const now = Math.floor(Date.now() / 1000)
  const claims: Session = {
    uid: payload.uid, email: payload.email, name: payload.name,
    v: SESSION_VERSION, aud: SESSION_AUDIENCE, iat: now, exp: now + SESSION_MAX_AGE,
  }
  const body = encode(new TextEncoder().encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(body))
  return `${body}.${encode(new Uint8Array(signature))}`
}

async function verify(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 8192) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [body, signature] = parts
    const valid = await crypto.subtle.verify('HMAC', await signingKey(), decode(signature), new TextEncoder().encode(body))
    if (!valid) return null
    const claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(body)))
    const now = Math.floor(Date.now() / 1000)
    if (!claims || claims.v !== SESSION_VERSION || claims.aud !== SESSION_AUDIENCE
      || !Number.isSafeInteger(claims.uid) || claims.uid < 1
      || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
      || claims.iat > now + 60 || claims.exp <= now || claims.exp <= claims.iat
      || claims.exp - claims.iat > SESSION_MAX_AGE
      || typeof claims.email !== 'string' || typeof claims.name !== 'string') return null
    return claims as Session
  } catch {
    return null
  }
}

async function activeUser(uid: number) {
  if (!Number.isSafeInteger(uid) || uid < 1) return null
  const user = await first<any>(
    `SELECT id, email, first_name, last_name, status, is_banned, deleted_at FROM users WHERE id = ? AND deleted_at IS NULL`,
    uid,
  )
  if (!user || Number(user.id) !== uid || user.deleted_at != null
    || ![1, '1'].includes(user.status) || ![0, '0'].includes(user.is_banned)) return null
  return user
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  const claims = await verify(token)
  if (!claims) return null
  const user = await activeUser(claims.uid)
  if (!user) return null
  return {
    ...claims,
    email: String(user.email ?? ''),
    name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
  }
}

export async function getSession() {
  return verifySessionToken(getCookie(SESSION_COOKIE))
}

export async function setSessionCookie(payload: SessionInput) {
  const user = await activeUser(payload.uid)
  if (!user) throw new Error('This account is disabled or unavailable.')
  const token = await sign({ uid: Number(user.id), email: String(user.email ?? ''), name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() })
  deleteCookie(LEGACY_SESSION_COOKIE, { path: '/' })
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: SESSION_MAX_AGE,
    sameSite: 'lax',
  })
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, { path: '/' })
  deleteCookie(LEGACY_SESSION_COOKIE, { path: '/' })
}
