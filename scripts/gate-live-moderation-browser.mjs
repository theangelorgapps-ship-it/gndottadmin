// Real moderation React/confirmation UI, with route + external server-function adapters only.
// No production server, account, comment, assignment, notification, or email is touched.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = process.cwd()
const artifacts = process.env.GATE_ARTIFACT_DIR || path.join(tmpdir(), 'halobox-live-moderation-browser')
mkdirSync(artifacts, { recursive: true })
const cssDirectory = path.join(root, 'dist/client/assets')
const cssName = readdirSync(cssDirectory).find(name => /^index-.*\.css$/.test(name))
assert.ok(cssName, 'Build the app first: this gate uses the actual compiled application styles.')
const applicationCss = readFileSync(path.join(cssDirectory, cssName))
const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-moderation-ui-'))
const channels = [{ id: 1, name: 'Channel One', status: 1, reports: 2 }, { id: 2, name: 'Channel Two', status: 1, reports: 0 }]
const comment = (id, body, overrides = {}) => ({ id, body, author_name: 'Alexandra Montgomery', created_at: '2026-11-09 10:00:00', hidden: 0, pinned: 0, restricted: 0, ...overrides })
const fresh = () => ({
  1: { comments: [comment(102, 'A thoughtful discussion for everyone.'), comment(101, 'Welcome to Channel One')], older: [comment(99, 'Earlier conversation')], reports: [
    { id: 11, comment_id: 101, author_name: 'Alexandra Montgomery', body: 'Welcome to Channel One', reason: 'Harassment', detail: 'Please review this conversation.', created_at: '2026-11-09 10:01:00' },
    { id: 12, comment_id: 102, author_name: 'Alexandra Montgomery', body: 'A thoughtful discussion for everyone.', reason: 'Spam', detail: '', created_at: '2026-11-09 10:02:00' },
  ], moderators: [{ user_id: 55, email: 'current.mod@example.test', name: 'Current Moderator' }], history: [] },
  2: { comments: [comment(201, 'Channel Two greeting'), comment(200, 'Long message: ' + 'word'.repeat(90))], older: [], reports: [], moderators: [], history: [] },
})
const states = new Map()
const apiLog = []
let failNextRead = false, failNextMutation = false, pendingMutation, browser, server
function holdNextMutation() {
  const hold = {}
  hold.started = new Promise(resolve => { hold.markStarted = resolve })
  hold.pending = new Promise(resolve => { hold.release = resolve })
  pendingMutation = hold
  return hold
}
const fixtureState = role => { if (!states.has(role)) states.set(role, fresh()); return states.get(role) }
const allowedChannels = role => role === 'empty' ? [] : role === 'moderator' ? [channels[1]] : channels
const delay = duration => new Promise(resolve => setTimeout(resolve, duration))
const boundarySource = `
const role=new URLSearchParams(location.search).get('role')||'admin';
async function call(name,data,write=false){const url='/fixture/'+name+'?role='+role+(write?'':'&data='+encodeURIComponent(JSON.stringify(data||{})));const response=await fetch(url,write?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await response.json();if(!response.ok)throw Error(result.error);return result;}
export const getModerationChannels=()=>call('channels');
export const getLiveModeration=({data})=>call('feed',data);
export const updateLiveModeration=({data})=>call('update',data,true);
export const setLiveModerator=({data})=>call('assignment',data,true);`
const hardDeadline = setTimeout(() => { console.error('MODERATION_BROWSER_TIMEOUT'); process.exitCode = 1; void browser?.close(); server?.closeAllConnections(); server?.close() }, 90000)
hardDeadline.unref()
try {
  await build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{LiveCommentsPage}from'./src/routes/admin/live-comments';import{ConfirmProvider}from'./src/lib/confirm';import{getModerationChannels}from'./src/lib/live-moderation';window.fixtureChannels=await getModerationChannels();createRoot(document.getElementById('app')).render(<ConfirmProvider><main><LiveCommentsPage/></main></ConfirmProvider>);`, resolveDir: root, loader: 'tsx' },
    bundle: true, outdir: temporary, platform: 'browser', format: 'esm', jsx: 'automatic',
    plugins: [{ name: 'moderation-boundaries', setup(builder) {
      builder.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: 'router', namespace: 'fixture' }))
      builder.onResolve({ filter: /lib\/live-moderation$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'router' ? "export const createFileRoute=()=>config=>({...config,useLoaderData:()=>window.fixtureChannels})" : boundarySource, loader: 'js' }))
    } }],
  })
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const send = (value, status = 200) => { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)) }
    try {
      if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html')
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/stdin.css"><style>body{margin:0;background:#090d17;color:#f5f6fb;font:14px system-ui}main{padding:28px;max-width:1256px;margin:auto}@media(max-width:640px){main{padding:16px}}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="app"></div><script type="module" src="/stdin.js"></script></body></html>'); return
      }
      if (url.pathname === '/app.css') { response.setHeader('Content-Type', 'text/css'); response.end(applicationCss); return }
      if (url.pathname === '/stdin.js' || url.pathname === '/stdin.css') { response.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(readFileSync(path.join(temporary, url.pathname))); return }
      if (!url.pathname.startsWith('/fixture/')) { response.statusCode = 404; response.end(); return }
      const role = url.searchParams.get('role') || 'admin'
      const operation = url.pathname.slice('/fixture/'.length)
      let data = JSON.parse(url.searchParams.get('data') || '{}')
      if (request.method === 'POST') { const chunks = []; for await (const chunk of request) chunks.push(chunk); data = JSON.parse(Buffer.concat(chunks).toString()) }
      apiLog.push({ role, operation, data })
      if (operation === 'channels') { send(allowedChannels(role)); return }
      if (!allowedChannels(role).some(channel => channel.id === data.channelId)) { send({ error: 'Channel access is required.' }, 403); return }
      const state = fixtureState(role)[data.channelId]
      if (operation === 'feed') {
        if (data.search === 'slow') await delay(350)
        if (failNextRead) { failNextRead = false; send({ error: 'Monitoring connection unavailable. Retry refresh.' }, 503); return }
        const rows = data.before ? state.older : state.comments
        const search = (data.search || '').toLowerCase()
        const comments = rows.filter(row => !search || (row.body + row.author_name).toLowerCase().includes(search))
        send({ comments, reports: state.reports, moderators: role === 'admin' ? state.moderators : [], history: state.history, nextBefore: data.channelId === 1 && !data.before && !search ? 100 : null, canAssign: role === 'admin', readOnly: role === 'demo' }); return
      }
      if (role === 'demo') { send({ error: 'View only.' }, 403); return }
      if (pendingMutation && ['update', 'assignment'].includes(operation)) {
        const hold = pendingMutation; pendingMutation = undefined; hold.markStarted(); await hold.pending
      }
      if (operation === 'update') {
        if (failNextMutation) { failNextMutation = false; send({ error: 'The moderation change could not be saved. Retry.' }, 503); return }
        const row = [...state.comments, ...state.older].find(item => item.id === data.targetId)
        if (data.action === 'resolve' || data.action === 'dismiss') state.reports = state.reports.filter(report => report.id !== data.targetId)
        else {
          assert.ok(row, 'UI sent an unknown comment ID')
          if (data.action === 'hide' || data.action === 'restore') { row.hidden = Number(data.action === 'hide'); row.pinned = 0 }
          if (data.action === 'pin' || data.action === 'unpin') row.pinned = Number(data.action === 'pin')
          if (data.action === 'mute' || data.action === 'unmute') row.restricted = Number(data.action === 'mute')
        }
        state.history.unshift({ id: state.history.length + 1, action: data.action, target_id: data.targetId, actor: 'Fixture Moderator', created_at: '2026-11-09 10:03:00' })
        send({ ok: true }); return
      }
      if (operation === 'assignment') {
        assert.equal(role, 'admin', 'Restricted UI attempted an assignment')
        if (data.enabled && data.email !== 'new.mod@example.test') { send({ error: 'Choose an existing active account with a unique email address.' }, 400); return }
        if (data.enabled) state.moderators.push({ user_id: 77, email: data.email, name: 'New Moderator' })
        else state.moderators = state.moderators.filter(mod => mod.user_id !== data.userId)
        state.history.unshift({ id: state.history.length + 1, action: data.enabled ? 'moderator_added' : 'moderator_removed', target_id: data.enabled ? 77 : data.userId, actor: 'Fixture Admin', created_at: '2026-11-09 10:04:00' })
        send({ ok: true }); return
      }
      send({ error: 'Unknown fixture endpoint' }, 404)
    } catch (error) { send({ error: error.message }, 500) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(5000)
  const errors = [], externalRequests = [], defects = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => { if (route.request().url().startsWith(origin + '/')) return route.continue(); externalRequests.push(route.request().url()); return route.abort() })
  const row = text => page.locator('article').filter({ has: page.locator('.moderation-body', { hasText: text }) })
  const selectedTab = async name => assert.equal(await page.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true')
  const ensureFits = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${label} must not overflow horizontally`)
  await page.goto(origin + '/?role=admin')
  await row('Welcome to Channel One').waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'Channel', exact: true }).locator('option').count(), 2)
  await page.getByRole('tab', { name: 'Messages', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await selectedTab('Reports (2)')
  await page.keyboard.press('End'); await selectedTab('Activity'); await page.keyboard.press('Home'); await selectedTab('Messages')
  assert.equal(await page.locator('[role=tab][tabindex="0"]').count(), 1)
  assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'), 'moderation-messages')

  const beforeCancel = apiLog.filter(call => call.operation === 'update').length
  await row('Welcome to Channel One').getByRole('button', { name: 'Delete message', exact: true }).click()
  await page.getByRole('dialog', { name: 'Delete this message?', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Cancel', 'Destructive confirmation must initially focus Cancel')
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' })
  assert.equal(apiLog.filter(call => call.operation === 'update').length, beforeCancel)
  await row('Welcome to Channel One').getByRole('button', { name: 'Delete message', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete message', exact: true }).click()
  await row('Welcome to Channel One').getByRole('button', { name: 'Restore', exact: true }).waitFor()
  assert.deepEqual(apiLog.findLast(call => call.operation === 'update').data, { channelId: 1, targetId: 101, action: 'hide' })
  await row('Welcome to Channel One').getByRole('button', { name: 'Restore', exact: true }).click()
  await row('Welcome to Channel One').getByRole('button', { name: 'Pin', exact: true }).click()
  await row('Welcome to Channel One').getByRole('button', { name: 'Unpin', exact: true }).waitFor()
  await row('Welcome to Channel One').getByRole('button', { name: 'Unpin', exact: true }).click()
  await row('Welcome to Channel One').getByRole('button', { name: 'Restrict viewer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restrict viewer', exact: true }).click()
  await row('Welcome to Channel One').getByRole('button', { name: 'Allow comments', exact: true }).waitFor()
  await row('Welcome to Channel One').getByRole('button', { name: 'Allow comments', exact: true }).click()
  await row('Welcome to Channel One').getByRole('button', { name: 'Restrict viewer', exact: true }).waitFor()

  failNextMutation = true
  await row('Welcome to Channel One').getByRole('button', { name: 'Pin', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor()
  assert.equal(await row('Welcome to Channel One').getByRole('button', { name: 'Pin', exact: true }).count(), 1)
  assert.equal(await page.getByRole('status').filter({ hasText: 'Pinned message' }).count(), 0)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('alert').waitFor({ state: 'detached' })
  failNextRead = true
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Monitoring connection unavailable' }).waitFor()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await row('Welcome to Channel One').waitFor()

  await page.getByRole('searchbox').fill('no matching phrase'); await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('heading', { name: 'No matching messages', exact: true }).waitFor()
  await page.getByRole('searchbox').fill(''); await page.getByRole('searchbox').press('Enter')
  await page.getByRole('button', { name: 'Older messages', exact: true }).click()
  await row('Earlier conversation').waitFor()
  assert.equal(apiLog.findLast(call => call.operation === 'feed').data.before, 100)
  await page.getByRole('button', { name: 'Back to latest', exact: true }).click(); await row('Welcome to Channel One').waitFor()
  // Hold actual fetches open while exercising the rendered pending-action controls.
  await page.getByRole('searchbox').fill('thoughtful')
  const pendingPin = holdNextMutation()
  await row('Welcome to Channel One').getByRole('button', { name: 'Pin', exact: true }).click()
  await pendingPin.started
  assert.equal(await page.getByRole('searchbox').isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Search', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('combobox', { name: 'Channel', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Older messages', exact: true }).isDisabled(), true)
  const beforePendingSubmit = apiLog.filter(call => call.operation === 'feed').length
  await page.locator('.moderation-search').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await page.getByRole('button', { name: 'Older messages', exact: true }).evaluate(button => button.click())
  assert.equal(apiLog.filter(call => call.operation === 'feed').length, beforePendingSubmit, 'Pending mutations must not launch a different search/page')
  pendingPin.release()
  await page.waitForFunction(() => !document.querySelector('.moderation-search input').disabled)
  assert.equal(apiLog.findLast(call => call.operation === 'feed').data.search, '')
  await row('Welcome to Channel One').getByRole('button', { name: 'Unpin', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await row('Welcome to Channel One').waitFor({ state: 'detached' }); await row('A thoughtful discussion for everyone.').waitFor()
  await page.getByRole('searchbox').fill(''); await page.getByRole('searchbox').press('Enter')
  await page.getByRole('button', { name: 'Older messages', exact: true }).click(); await row('Earlier conversation').waitFor()
  const pendingOlderPin = holdNextMutation()
  await row('Earlier conversation').getByRole('button', { name: 'Pin', exact: true }).click(); await pendingOlderPin.started
  assert.equal(await page.getByRole('button', { name: 'Back to latest', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Back to latest', exact: true }).evaluate(button => button.click())
  pendingOlderPin.release()
  await page.waitForFunction(() => !document.querySelector('.moderation-search input').disabled)
  assert.equal(apiLog.findLast(call => call.operation === 'feed').data.before, 100)
  await row('Earlier conversation').getByRole('button', { name: 'Unpin', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Back to latest', exact: true }).click(); await row('Welcome to Channel One').waitFor()
  await page.getByRole('tab', { name: 'Reports (2)', exact: true }).click()
  await page.locator('article').filter({ hasText: 'Harassment' }).getByRole('button', { name: 'Resolve', exact: true }).click()
  await page.getByRole('tab', { name: 'Reports (1)', exact: true }).waitFor()
  assert.deepEqual(apiLog.findLast(call => call.operation === 'update').data, { channelId: 1, targetId: 11, action: 'resolve' })
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click(); await page.getByRole('heading', { name: 'No open reports', exact: true }).waitFor()

  await page.getByRole('tab', { name: 'Moderators', exact: true }).click()
  await page.getByRole('textbox', { name: 'Existing account email', exact: true }).fill('missing@example.test')
  await page.getByRole('button', { name: 'Add moderator', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'existing active account' }).waitFor()
  assert.equal(await page.getByText('New Moderator', { exact: true }).count(), 0)
  await page.getByRole('textbox', { name: 'Existing account email', exact: true }).fill('new.mod@example.test')
  const pendingAssignment = holdNextMutation()
  await page.getByRole('button', { name: 'Add moderator', exact: true }).click()
  await pendingAssignment.started
  await page.getByRole('tab', { name: 'Messages', exact: true }).click()
  assert.equal(await page.getByRole('searchbox').isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Older messages', exact: true }).isDisabled(), true)
  pendingAssignment.release()
  await page.waitForFunction(() => !document.querySelector('.moderation-search input').disabled)
  await page.getByRole('tab', { name: 'Moderators', exact: true }).click()
  await page.getByText('New Moderator', { exact: true }).waitFor()
  assert.deepEqual(apiLog.findLast(call => call.operation === 'assignment').data, { channelId: 1, email: 'new.mod@example.test', enabled: true })
  await page.locator('.moderation-team li').filter({ hasText: 'new.mod@example.test' }).getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove moderator', exact: true }).click()
  await page.getByText('New Moderator', { exact: true }).waitFor({ state: 'detached' })
  assert.deepEqual(apiLog.findLast(call => call.operation === 'assignment').data, { channelId: 1, userId: 77, enabled: false })
  await page.getByRole('tab', { name: 'Activity', exact: true }).click(); await page.locator('.moderation-history').getByText('Removed moderator', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(artifacts, 'moderation-desktop.png') })

  // A delayed search response from the previous channel must never replace the new channel.
  await page.getByRole('tab', { name: 'Messages', exact: true }).click()
  const slowResponse = page.waitForResponse(response => response.url().includes('/fixture/feed') && new URL(response.url()).searchParams.get('data')?.includes('slow'))
  const slowRequest = page.waitForRequest(request => request.url().includes('/fixture/feed') && new URL(request.url()).searchParams.get('data')?.includes('slow'))
  await page.getByRole('searchbox').fill('slow'); await page.getByRole('searchbox').press('Enter'); await slowRequest
  await page.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('2')
  await row('Channel Two greeting').waitFor(); await slowResponse
  await ensureFits('Desktop moderation')
  assert.equal(await page.getByRole('searchbox').inputValue(), '')
  await row('Channel Two greeting').waitFor()

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await ensureFits(`${width}px messages`)
    await page.getByRole('tab', { name: 'Messages', exact: true }).focus(); await page.keyboard.press('End'); await selectedTab('Activity')
    await page.waitForFunction(() => { const r = document.getElementById('moderation-history').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth }, undefined, { timeout: 1500 }).catch(() => {})
    const box = await page.getByRole('tab', { name: 'Activity', exact: true }).boundingBox()
    if (!(box.x >= 0 && box.x + box.width <= width)) await page.screenshot({ path: path.join(artifacts, `moderation-tab-failure-${width}.png`) })
    if (!(box.x >= 0 && box.x + box.width <= width)) defects.push(`Keyboard-selected tab must scroll into view: viewport=${width}, box=${JSON.stringify(box)}`)
    await page.keyboard.press('ArrowLeft'); await selectedTab('Moderators'); await ensureFits(`${width}px assignment form`)
    await page.screenshot({ path: path.join(artifacts, `moderation-admin-${width}.png`) })
    await page.getByRole('tab', { name: 'Messages', exact: true }).click()
    await page.screenshot({ path: path.join(artifacts, `moderation-messages-${width}.png`) })
  }

  await page.goto(origin + '/?role=moderator'); await row('Channel Two greeting').waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'Channel', exact: true }).locator('option').count(), 1)
  assert.equal(await page.getByRole('combobox', { name: 'Channel', exact: true }).inputValue(), '2')
  await row('Channel Two greeting').getByRole('button', { name: 'Pin', exact: true }).click()
  await row('Channel Two greeting').getByRole('button', { name: 'Unpin', exact: true }).waitFor()
  assert.deepEqual(apiLog.findLast(call => call.operation === 'update').data, { channelId: 2, targetId: 201, action: 'pin' })
  await page.getByRole('tab', { name: 'Moderators', exact: true }).click()
  await page.getByText('Ask an administrator to manage this channel’s moderation team.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Existing account email', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Add moderator', exact: true }).count(), 0)
  assert.equal(apiLog.filter(call => call.role === 'moderator' && call.operation === 'assignment').length, 0)
  await ensureFits('Restricted moderator mobile'); await page.screenshot({ path: path.join(artifacts, 'moderation-restricted-320.png') })

  await page.goto(origin + '/?role=demo'); await row('Welcome to Channel One').waitFor()
  await page.getByText('Demo account · view only', { exact: true }).waitFor()
  for (const button of await page.locator('.moderation-actions button').all()) assert.equal(await button.isDisabled(), true)
  await page.getByRole('tab', { name: 'Moderators', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Add moderator', exact: true }).count(), 0)
  await page.goto(origin + '/?role=empty'); await page.getByRole('heading', { name: 'No channels to monitor', exact: true }).waitFor()
  assert.equal(apiLog.filter(call => call.role === 'empty' && call.operation !== 'channels').length, 0)
  assert.deepEqual(errors, [], 'React must not raise runtime errors')
  assert.deepEqual(externalRequests, [], 'The fixture must make no external network requests')
  assert.deepEqual(defects, [], 'Responsive interaction regressions')
  console.log(`LIVE_MODERATION_BROWSER_OK: actual React + confirmation UI; keyboard tabs, channel/search/pagination, pending mutation/assignment search and page locks, cancelled/approved delete, restore/pin/restrict, reports, errors/retry, admin assignment/revoke, activity, stale-response isolation, 1280/390/320 layouts, restricted/demo/empty views; ${apiLog.length} localhost-only API calls. Screenshots: ${artifacts}`)
} finally {
  clearTimeout(hardDeadline)
  await browser?.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  rmSync(temporary, { recursive: true, force: true })
}
