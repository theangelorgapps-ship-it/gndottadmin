import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { getSession } from './session.server'
import { all, first } from './db'

type WorkspaceUser = { id: number; email: string; first_name: string | null; last_name: string | null; user_type: string; workspaceRole: 'admin' | 'moderator' }
const positiveId = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Choose a valid channel or message.')
  return value
}
function protectWrite() {
  const request = getRequest()
  const origin = request.headers.get('origin')
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new Error('This request is not allowed.')
}
async function workspaceUser(): Promise<WorkspaceUser | null> {
  setResponseHeader('Cache-Control', 'private, no-store')
  const session = await getSession()
  if (!session) return null
  const user = await first<Omit<WorkspaceUser, 'workspaceRole'>>(`SELECT id,email,first_name,last_name,user_type FROM users
    WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0`, session.uid)
  if (!user) return null
  if (['admin', 'demo_admin'].includes(user.user_type)) return { ...user, workspaceRole: 'admin' }
  const assignment = await first(`SELECT 1 FROM live_chat_moderators m JOIN live_tv_channel c ON c.id=m.channel_id
    WHERE m.user_id=? AND c.deleted_at IS NULL LIMIT 1`, user.id)
  return assignment ? { ...user, workspaceRole: 'moderator' } : null
}
async function requireWorkspace(write = false) {
  const user = await workspaceUser()
  if (!user) throw new Error('Sign in with a monitoring account. Channel access is required.')
  if (write && user.user_type === 'demo_admin') throw new Error('Demo administrators have read-only access.')
  return user
}
async function requireChannel(user: WorkspaceUser, channelId: number) {
  const channel = await first(`SELECT id FROM live_tv_channel WHERE id=? AND deleted_at IS NULL`, channelId)
  if (!channel) throw new Error('Channel not found.')
  if (user.workspaceRole !== 'admin' && !await first(`SELECT 1 FROM live_chat_moderators WHERE channel_id=? AND user_id=?`, channelId, user.id)) throw new Error('Channel monitoring access is required.')
}
export const getWorkspaceSession = createServerFn({ method: 'GET' }).handler(workspaceUser)

export const getModerationChannels = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireWorkspace()
  return all<{ id: number; name: string; status: number; reports: number }>(`SELECT c.id,c.name,c.status,
    (SELECT COUNT(*) FROM live_comment_reports r WHERE r.channel_id=c.id AND r.status='open') AS reports
    FROM live_tv_channel c WHERE c.deleted_at IS NULL AND (?=1 OR EXISTS(SELECT 1 FROM live_chat_moderators m WHERE m.channel_id=c.id AND m.user_id=?))
    ORDER BY c.name LIMIT 250`, user.workspaceRole === 'admin' ? 1 : 0, user.id)
})

export const getLiveModeration = createServerFn({ method: 'GET' }).validator((input: { channelId: number; before?: number; search?: string }) => {
  const channelId = positiveId(input?.channelId)
  if (input.search !== undefined && (typeof input.search !== 'string' || input.search.length > 200)) throw new Error('Use at most 200 characters to search.')
  return { channelId, before: input.before === undefined ? null : positiveId(input.before), search: input.search?.trim() || '' }
}).handler(async ({ data }) => {
  const user = await requireWorkspace()
  await requireChannel(user, data.channelId)
  const comments = await all<{ id: number; body: string; author_name: string; created_at: string; hidden: number; pinned: number; restricted: number }>(`SELECT c.id,c.body,c.author_name,c.created_at,c.hidden,c.pinned,
    EXISTS(SELECT 1 FROM live_chat_mutes m WHERE m.channel_id=c.channel_id AND m.user_id=c.user_id) AS restricted
    FROM live_comments c WHERE c.channel_id=? AND (? IS NULL OR c.id<?) AND (?='' OR instr(lower(c.body),lower(?))>0 OR instr(lower(c.author_name),lower(?))>0)
    ORDER BY c.id DESC LIMIT 101`, data.channelId, data.before, data.before, data.search, data.search, data.search)
  const reports = await all<{ id: number; comment_id: number; body: string; author_name: string; reason: string; detail: string; created_at: string }>(`SELECT r.id,r.comment_id,c.body,c.author_name,r.reason,r.detail,r.created_at
    FROM live_comment_reports r JOIN live_comments c ON c.id=r.comment_id AND c.channel_id=r.channel_id
    WHERE r.channel_id=? AND r.status='open' ORDER BY r.id DESC LIMIT 100`, data.channelId)
  const moderators = user.workspaceRole === 'admin' ? await all<{ user_id: number; email: string; name: string }>(`SELECT m.user_id,u.email,trim(COALESCE(u.first_name,'')||' '||COALESCE(u.last_name,'')) AS name
    FROM live_chat_moderators m JOIN users u ON u.id=m.user_id WHERE m.channel_id=? ORDER BY m.created_at LIMIT 100`, data.channelId) : []
  const history = await all<{ id: number; action: string; target_id: number | null; created_at: string; actor: string }>(`SELECT l.id,l.action,l.target_id,l.created_at,COALESCE(u.first_name,'Moderator') AS actor
    FROM live_moderation_log l LEFT JOIN users u ON u.id=l.admin_id WHERE l.channel_id=? ORDER BY l.id DESC LIMIT 30`, data.channelId)
  return { comments: comments.slice(0, 100), nextBefore: comments.length > 100 ? comments[99].id : null, reports, moderators, history, canAssign: user.user_type === 'admin', readOnly: user.user_type === 'demo_admin' }
})

const ACTIONS = ['hide', 'restore', 'pin', 'unpin', 'mute', 'unmute', 'resolve', 'dismiss'] as const
export const updateLiveModeration = createServerFn({ method: 'POST' }).validator((input: { channelId: number; targetId: number; action: string }) => {
  if (!ACTIONS.includes(input?.action as any)) throw new Error('Choose a valid moderation action.')
  return { channelId: positiveId(input.channelId), targetId: positiveId(input.targetId), action: input.action }
}).handler(async ({ data }) => {
  protectWrite()
  const user = await requireWorkspace(true)
  await requireChannel(user, data.channelId)
  const db = (env as any).DB
  let statement
  if (['resolve', 'dismiss'].includes(data.action)) {
    if (!await first('SELECT id FROM live_comment_reports WHERE id=? AND channel_id=?', data.targetId, data.channelId)) throw new Error('Report not found.')
    statement = db.prepare('UPDATE live_comment_reports SET status=?,resolved_by=? WHERE id=? AND channel_id=?')
      .bind(data.action === 'resolve' ? 'resolved' : 'dismissed', user.id, data.targetId, data.channelId)
  } else {
    const comment = await first<{ user_id: number; user_type: string }>(`SELECT c.user_id,u.user_type FROM live_comments c JOIN users u ON u.id=c.user_id WHERE c.id=? AND c.channel_id=?`, data.targetId, data.channelId)
    if (!comment) throw new Error('Comment not found.')
    if (data.action === 'mute') {
      if (['admin', 'demo_admin'].includes(comment.user_type) || await first('SELECT 1 FROM live_chat_moderators WHERE channel_id=? AND user_id=?', data.channelId, comment.user_id)) throw new Error('Remove staff monitoring access before restricting that account.')
      statement = db.prepare('INSERT INTO live_chat_mutes(channel_id,user_id,moderator_id) VALUES(?,?,?) ON CONFLICT(channel_id,user_id) DO NOTHING').bind(data.channelId, comment.user_id, user.id)
    } else if (data.action === 'unmute') {
      statement = db.prepare('DELETE FROM live_chat_mutes WHERE channel_id=? AND user_id=?').bind(data.channelId, comment.user_id)
    } else if (data.action === 'hide' || data.action === 'restore') {
      statement = db.prepare('UPDATE live_comments SET hidden=?,pinned=0 WHERE id=? AND channel_id=?').bind(data.action === 'hide' ? 1 : 0, data.targetId, data.channelId)
    } else {
      statement = db.prepare('UPDATE live_comments SET pinned=? WHERE id=? AND channel_id=? AND hidden=0').bind(data.action === 'pin' ? 1 : 0, data.targetId, data.channelId)
    }
  }
  // Mutation and audit either commit together or roll back together.
  await db.batch([statement, db.prepare('INSERT INTO live_moderation_log(channel_id,admin_id,action,target_id) VALUES(?,?,?,?)').bind(data.channelId, user.id, data.action, data.targetId)])
  return { ok: true }
})

export const setLiveModerator = createServerFn({ method: 'POST' }).validator((input: { channelId: number; email?: string; userId?: number; enabled: boolean }) => {
  const channelId = positiveId(input?.channelId)
  if (typeof input.enabled !== 'boolean') throw new Error('Choose a valid assignment.')
  if (input.enabled) {
    if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error('Enter the existing account email.')
    return { channelId, enabled: true, email: input.email.trim().toLowerCase(), userId: null }
  }
  return { channelId, enabled: false, email: null, userId: positiveId(input.userId) }
}).handler(async ({ data }) => {
  protectWrite()
  const user = await requireWorkspace(true)
  if (user.user_type !== 'admin') throw new Error('A full administrator must manage monitoring assignments.')
  await requireChannel(user, data.channelId)
  const db = (env as any).DB
  let target = data.userId
  if (data.enabled) {
    const matches = await all<{ id: number; user_type: string }>(`SELECT id,user_type FROM users WHERE lower(trim(email))=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0 LIMIT 2`, data.email)
    if (matches.length !== 1) throw new Error('Choose an existing active account with a unique email address.')
    if (['admin', 'demo_admin'].includes(matches[0].user_type)) throw new Error('This account already has administrator access.')
    target = matches[0].id
    const count = await first<{ n: number }>('SELECT COUNT(*) AS n FROM live_chat_moderators WHERE channel_id=?', data.channelId)
    if ((count?.n ?? 0) >= 100) throw new Error('This channel already has 100 moderators.')
  }
  await db.batch([
    data.enabled
      ? db.prepare(`INSERT INTO live_chat_moderators(channel_id,user_id,assigned_by) VALUES(?,?,?) ON CONFLICT(channel_id,user_id) DO NOTHING`).bind(data.channelId, target, user.id)
      : db.prepare('DELETE FROM live_chat_moderators WHERE channel_id=? AND user_id=?').bind(data.channelId, target),
    db.prepare('INSERT INTO live_moderation_log(channel_id,admin_id,action,target_id) VALUES(?,?,?,?)').bind(data.channelId, user.id, data.enabled ? 'moderator_added' : 'moderator_removed', target),
  ])
  return { ok: true }
})
