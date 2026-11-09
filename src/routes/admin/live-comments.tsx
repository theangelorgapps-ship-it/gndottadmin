import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react'
import { getModerationChannels, getLiveModeration, updateLiveModeration, setLiveModerator } from '../../lib/live-moderation'
import { useConfirm } from '../../lib/confirm'
import '../../live-moderation.css'

export const Route = createFileRoute('/admin/live-comments')({
  loader: () => getModerationChannels(),
  component: LiveCommentsPage,
})
type Feed = Awaited<ReturnType<typeof getLiveModeration>>
const actionNames: Record<string, string> = { hide: 'Deleted message', restore: 'Restored message', mute: 'Restricted viewer', unmute: 'Restored commenting', pin: 'Pinned message', unpin: 'Unpinned message', resolve: 'Resolved report', dismiss: 'Dismissed report', moderator_added: 'Added moderator', moderator_removed: 'Removed moderator', settings: 'Updated channel settings' }
function stamp(value: string) { return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toLocaleString() }

export function LiveCommentsPage() {
  const channels = Route.useLoaderData()
  const [channelId, setChannelId] = useState(channels[0]?.id || 0)
  const [feed, setFeed] = useState<Feed | null>(null)
  const [view, setView] = useState<'messages' | 'reports' | 'team' | 'history'>('messages')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('')
  const [before, setBefore] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updated, setUpdated] = useState<Date | null>(null)
  const request = useRef(0)
  const inFlight = useRef(false)
  const confirm = useConfirm()
  const refresh = useCallback(async (quiet = false) => {
    if (!channelId) return
    const ticket = ++request.current
    inFlight.current = true
    if (!quiet) setLoading(true)
    try {
      const result = await getLiveModeration({ data: { channelId, search: query, before } })
      if (ticket !== request.current) return
      setFeed(result); setError(''); setUpdated(new Date())
    } catch (err) {
      if (ticket === request.current) { setError(err instanceof Error ? err.message : 'Unable to load live comments.'); setFeed(null) }
    } finally {
      if (ticket === request.current) { inFlight.current = false; setLoading(false) }
    }
  }, [channelId, query, before])
  useEffect(() => {
    setFeed(null); setNotice(''); void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !inFlight.current && !before) void refresh(true)
    }, 8000)
    return () => { window.clearInterval(interval); request.current++; inFlight.current = false }
  }, [refresh, before])
  async function mutate(action: string, targetId: number) {
    if (busy || !channelId) return
    if (['hide', 'mute'].includes(action) && !await confirm({ title: action === 'hide' ? 'Delete this message?' : 'Restrict this viewer?', description: action === 'hide' ? 'It will disappear from this channel’s chat. You can restore it here.' : 'This account will no longer be able to comment on this channel.', approveLabel: action === 'hide' ? 'Delete message' : 'Restrict viewer' })) return
    setBusy(true); setError(''); setNotice('')
    try { await updateLiveModeration({ data: { channelId, targetId, action } }); setNotice(actionNames[action]); await refresh(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'The change could not be saved.') }
    finally { setBusy(false) }
  }
  async function assign(userId?: number) {
    if (busy) return
    if (userId && !await confirm({ title: 'Remove this moderator?', description: 'Their monitoring access to this channel will end immediately.', approveLabel: 'Remove moderator' })) return
    setBusy(true); setError(''); setNotice('')
    try { await setLiveModerator({ data: { channelId, email: userId ? undefined : email, userId, enabled: !userId } }); setEmail(''); setNotice(userId ? 'Moderator removed.' : 'Moderator added. They can sign in at fort.halobox.tv.'); await refresh(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'The assignment could not be saved.') }
    finally { setBusy(false) }
  }
  const channel = channels.find(item => item.id === channelId)
  return <section className="moderation-workspace" aria-labelledby="live-comments-title">
    <header className="moderation-heading"><div><span className="moderation-kicker">Community</span><h1 id="live-comments-title">Live comments</h1><p>Manage conversations across your channels.</p></div><button type="button" className="btn" onClick={() => void refresh()} disabled={loading || busy || !channelId}><RefreshCw size={17} />Refresh</button></header>
    {!channels.length ? <div className="moderation-empty"><MessageSquare /><h2>No channels to monitor</h2><p>An administrator can assign channel access here.</p></div> : <>
      <div className="moderation-toolbar"><label>Channel<select value={channelId} disabled={busy} onChange={event => { setChannelId(Number(event.target.value)); setBefore(undefined); setQuery(''); setSearch('') }}>{channels.map(item => <option value={item.id} key={item.id}>{item.name}{item.status ? '' : ' · inactive'}</option>)}</select></label><span className="moderation-updated" aria-live="off">{updated ? `Updated ${updated.toLocaleTimeString()}` : 'Connecting…'}</span></div>
      <div className="moderation-tabs" role="tablist" aria-label="Comment monitoring" onKeyDown={event => {
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
        const index = tabs.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
        if (next >= 0) { event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click(); tabs[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
      }}>
        {(['messages', 'reports', 'team', 'history'] as const).map(tab => <button type="button" key={tab} role="tab" tabIndex={view === tab ? 0 : -1} id={`moderation-${tab}`} aria-selected={view === tab} aria-controls="moderation-content" onClick={() => setView(tab)}>{tab === 'messages' ? 'Messages' : tab === 'reports' ? `Reports${feed?.reports.length ? ` (${feed.reports.length})` : ''}` : tab === 'team' ? 'Moderators' : 'Activity'}</button>)}
      </div>
      {error && <p className="moderation-error" role="alert">{error}</p>}{notice && <p className="moderation-notice" role="status">{notice}</p>}
      {feed?.readOnly && <p className="moderation-notice">Demo account · view only</p>}
      <div id="moderation-content" role="tabpanel" aria-labelledby={`moderation-${view}`} aria-busy={loading}>
        {view === 'messages' && <form className="moderation-search" onSubmit={event => { event.preventDefault(); setBefore(undefined); setQuery(search) }}><Search size={18} /><input type="search" aria-label="Search messages or names" placeholder="Search messages or names" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /><button type="submit" className="btn">Search</button></form>}
        {loading && !feed && <div className="moderation-loading" role="status"><span className="sr-only">Loading comments</span>{[0, 1, 2].map(i => <div key={i} />)}</div>}
        {feed && view === 'messages' && <><div className="moderation-messages">{feed.comments.length ? feed.comments.map(comment => <article className={`moderation-message${comment.hidden ? ' is-hidden' : ''}`} key={comment.id}>
          <div className="moderation-message-header"><span className="moderation-avatar" aria-hidden="true">{comment.author_name.slice(0, 1).toUpperCase()}</span><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{stamp(comment.created_at)}</time></div>
          <p className="moderation-body">{comment.body}</p><div className="moderation-message-status">{Boolean(comment.hidden) && <span>Deleted</span>}{Boolean(comment.pinned) && <span>Pinned</span>}{Boolean(comment.restricted) && <span>Commenting restricted</span>}</div>
          <div className="moderation-actions"><button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate(comment.hidden ? 'restore' : 'hide', comment.id)}>{comment.hidden ? 'Restore' : 'Delete message'}</button>{!comment.hidden && <button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate(comment.pinned ? 'unpin' : 'pin', comment.id)}>{comment.pinned ? 'Unpin' : 'Pin'}</button>}<button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate(comment.restricted ? 'unmute' : 'mute', comment.id)}>{comment.restricted ? 'Allow comments' : 'Restrict viewer'}</button></div>
        </article>) : <div className="moderation-empty"><MessageSquare /><h2>{query ? 'No matching messages' : 'No messages yet'}</h2><p>{query ? 'Try a different word or name.' : `New comments on ${channel?.name} will appear here.`}</p></div>}</div><div className="moderation-pagination">{before && <button className="btn" onClick={() => setBefore(undefined)}>Back to latest</button>}{feed.nextBefore && <button className="btn" onClick={() => setBefore(feed.nextBefore!)}>Older messages</button>}</div></>}
        {feed && view === 'reports' && <div className="moderation-messages">{feed.reports.length ? feed.reports.map(report => <article key={report.id} className="moderation-message"><div className="moderation-message-header"><ShieldCheck size={20} /><strong>{report.reason}</strong><time>{stamp(report.created_at)}</time></div><p className="moderation-body"><strong>{report.author_name}: </strong>{report.body}</p>{report.detail && <p>{report.detail}</p>}<div className="moderation-actions"><button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate('hide', report.comment_id)}>Delete message</button><button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate('mute', report.comment_id)}>Restrict viewer</button><button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate('resolve', report.id)}>Resolve</button><button className="btn" disabled={busy || feed.readOnly} onClick={() => void mutate('dismiss', report.id)}>Dismiss</button></div></article>) : <div className="moderation-empty"><ShieldCheck /><h2>No open reports</h2></div>}</div>}
        {feed && view === 'team' && <div className="moderation-team"><h2><Users size={21} />Channel moderators</h2><p>Moderators manage this channel’s comments. Only administrators can change assignments.</p>{feed.canAssign ? <><form className="moderation-assignment" onSubmit={event => { event.preventDefault(); void assign() }}><label>Existing account email<input type="email" autoComplete="off" value={email} required maxLength={254} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label><button className="btn primary" disabled={busy || !email.trim()} type="submit">Add moderator</button></form><ul>{feed.moderators.map(mod => <li key={mod.user_id}><div><strong>{mod.name || mod.email}</strong><span>{mod.email}</span></div><button className="btn" disabled={busy} onClick={() => void assign(mod.user_id)}>Remove</button></li>)}</ul>{!feed.moderators.length && <p>No additional moderators assigned.</p>}</> : <p>Ask an administrator to manage this channel’s moderation team.</p>}</div>}
        {feed && view === 'history' && <div className="moderation-history"><h2>Recent activity</h2>{feed.history.length ? <ol>{feed.history.map(event => <li key={event.id}><strong>{actionNames[event.action] || 'Updated channel'}</strong><span>{event.actor} · {stamp(event.created_at)}{event.target_id ? ` · #${event.target_id}` : ''}</span></li>)}</ol> : <p>No moderation changes yet.</p>}</div>}
      </div>
    </>}
  </section>
}
