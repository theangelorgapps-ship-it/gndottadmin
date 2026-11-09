// Media ingest gate: Dropbox link ingestion → Bunny fetch → progress phases → completion.
// Part 1 exercises the real core module in node. Part 2 drives the real route in a browser
// with the server boundary stubbed by a stateful in-memory job store (no live Bunny/Dropbox).
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-media-ingest-'))

async function bundle(contents, platform) {
  const out = path.join(temporary, platform === 'node' ? 'core.mjs' : 'stdin.js')
  await build({
    stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, outfile: out, platform, format: 'esm', jsx: 'automatic',
    plugins: platform === 'browser' ? [boundaryStubs] : [],
  })
  return out
}

// Browser bundle stubs: the server boundary wires the REAL core to an in-memory store
// and a scripted Bunny client, so UI behaviour runs against production logic.
const boundaryStubs = {
  name: 'boundary-stubs',
  setup(b) {
    b.onResolve({ filter: /(^|\/)media-ingest$/ }, (args) =>
      args.path.includes('routes/') ? null : { path: 'server', namespace: 'fixture' })
    b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: 'router', namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: p }) => {
      if (p === 'server') return { loader: 'js', resolveDir: process.cwd(), contents: SERVER_FIXTURE }
      return {
        loader: 'js',
        contents: `export const Link=({children})=>children;
          export const createFileRoute=()=>options=>({...options,useLoaderData:()=>window.fixtureLoaderData(),useRouteContext:()=>({admin:{id:1,email:'admin.local@halobox.test',workspaceRole:'admin'}})});
          export const useRouter=()=>({invalidate:()=>{window.invalidated=true}});
          export const useRouterState=()=>false;
          export const Outlet=()=>null;
          export const redirect=(o)=>({redirect:o});`,
      }
    })
  },
}

// Browser bundle stub: the server boundary wires the REAL core to an in-memory
// store and a scripted Bunny client (both installed on window by the harness),
// so UI behaviour runs against production logic with production response shapes.
const SERVER_FIXTURE = `
import * as core from './src/lib/media-ingest-core'
const deps = () => window.ingestStore.deps()
export const ingestDropboxLink = async ({ data }) => { const d = deps(); return core.createIngestJob(d.store, d.bunny, data) }
export const refreshIngestJobs = async () => { const d = deps(); await core.refreshIngestJobs(d.store, d.bunny); return { configured: true, libraryId: '347005', jobs: await d.store.listJobs() } }
export const cancelIngestJob = async ({ data }) => { const d = deps(); await core.cancelIngestJob(d.store, d.bunny, Number(data)); return { ok: true } }
export const retryIngestJob = async ({ data }) => { const d = deps(); return core.retryIngestJob(d.store, d.bunny, Number(data)) }
export const listIngestJobs = async () => { const d = deps(); return { configured: true, libraryId: '347005', jobs: await d.store.listJobs() } }
export const ingestFormOptions = async () => window.ingestStore.formOptions
`

let browser, server
try {
  // ---------- Part 1: core module behaviour ----------
  const corePath = await bundle(`export * from './src/lib/media-ingest-core'`, 'node')
  const core = await import(corePath)

  // Dropbox shared links rewrite to direct-download URLs; everything else is rejected.
  assert.equal(
    core.normalizeDropboxUrl('https://www.dropbox.com/s/abc123/sermon.mp4?dl=0'),
    'https://dl.dropboxusercontent.com/s/abc123/sermon.mp4?dl=1',
  )
  assert.equal(
    core.normalizeDropboxUrl('https://www.dropbox.com/scl/fi/xyz/teaching.mp4?rlkey=secret&dl=0'),
    'https://dl.dropboxusercontent.com/scl/fi/xyz/teaching.mp4?rlkey=secret&dl=1',
  )
  assert.equal(
    core.normalizeDropboxUrl('https://dl.dropboxusercontent.com/s/abc123/sermon.mp4'),
    'https://dl.dropboxusercontent.com/s/abc123/sermon.mp4?dl=1',
  )
  assert.equal(core.normalizeDropboxUrl('https://example.com/video.mp4'), null)
  assert.equal(core.normalizeDropboxUrl('http://www.dropbox.com/s/abc/sermon.mp4?dl=0'), null)
  assert.equal(core.normalizeDropboxUrl('not a url'), null)
  assert.equal(core.normalizeDropboxUrl(''), null)
  console.log('CORE_LINK_OK: dropbox share links rewrite to direct-download URLs, foreign links rejected')

  // Bunny status + encodeProgress map onto widget phases: fetching (0-20%),
  // transcoding (20-100% via encodeProgress), complete, failed.
  assert.deepEqual(core.phaseFor(null, 0), { phase: 'fetching', progress: 0 })
  assert.deepEqual(core.phaseFor(0, 0), { phase: 'fetching', progress: 5 })
  assert.deepEqual(core.phaseFor(1, 0), { phase: 'fetching', progress: 15 })
  assert.deepEqual(core.phaseFor(2, 0), { phase: 'fetching', progress: 25 })
  assert.deepEqual(core.phaseFor(3, 0), { phase: 'transcoding', progress: 20 })
  assert.deepEqual(core.phaseFor(3, 50), { phase: 'transcoding', progress: 60 })
  assert.deepEqual(core.phaseFor(7, 90), { phase: 'transcoding', progress: 92 })
  assert.deepEqual(core.phaseFor(8, 100), { phase: 'transcoding', progress: 100 })
  assert.deepEqual(core.phaseFor(4, 100), { phase: 'complete', progress: 100 })
  assert.deepEqual(core.phaseFor(5, 40), { phase: 'failed', progress: 52 })
  assert.deepEqual(core.phaseFor(6, 0), { phase: 'failed', progress: 0 })
  console.log('CORE_PHASE_OK: bunny status and encodeProgress map to fetch/transcode/complete/failed phases')

  // Completion embed snippet targets the Bunny iframe player for the configured library.
  const snippet = core.embedSnippet('347005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  assert.ok(snippet.includes('https://iframe.mediadelivery.net/embed/347005/a1b2c3d4-e5f6-7890-abcd-ef1234567890'))
  assert.ok(/^<iframe\s[^>]*><\/iframe>$/.test(snippet))
  assert.ok(!snippet.includes('<script'))
  console.log('CORE_EMBED_OK: completion renders a copyable Bunny iframe snippet')

  // ---------- job lifecycle against the in-memory store + scripted Bunny ----------
  const { createMemoryIngestStore, createScriptedBunny } = await import('./ingest-test-doubles.mjs')

  // createIngestJob validates the link before anything is stored or sent to Bunny.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    await assert.rejects(() => core.createIngestJob(store, bunny, { url: 'https://example.com/v.mp4', title: 'X', destination: 'video' }), /valid Dropbox/)
    assert.equal(bunny.calls.fetchVideo.length, 0)
    assert.equal(store.jobs.length, 0)
  }
  // A valid sermon ingest: Bunny fetch carries the rewritten URL and title;
  // the job starts in fetching and a Sermon (entertainments type=movie) row exists immediately.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const job = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/abc123/sermon.mp4?dl=0', title: 'Easter Sermon', destination: 'sermon' })
    assert.equal(bunny.calls.fetchVideo.length, 1)
    assert.deepEqual(bunny.calls.fetchVideo[0], { url: 'https://dl.dropboxusercontent.com/s/abc123/sermon.mp4?dl=1', title: 'Easter Sermon' })
    assert.equal(job.phase, 'fetching')
    assert.equal(job.content_table, 'entertainments')
    const row = store.content.entertainments[0]
    assert.equal(row.type, 'movie')
    assert.equal(row.name, 'Easter Sermon')
    assert.equal(row.slug, 'easter-sermon')
    assert.equal(row.status, 1)
    assert.equal(row.bunny_video_url ?? null, null)
  }
  // Teaching creates an episode under the chosen series/volume.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const job = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/t1/lesson.mp4?dl=0', title: 'Lesson 1', destination: 'teaching', seriesId: 12, seasonId: 31 })
    assert.equal(job.content_table, 'episodes')
    const row = store.content.episodes[0]
    assert.equal(row.entertainment_id, 12)
    assert.equal(row.season_id, 31)
    assert.equal(row.name, 'Lesson 1')
  }
  // General videos land in the videos table; shows land as episodes too.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const videoJob = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/v1/clip.mp4?dl=0', title: 'Clip', destination: 'video' })
    assert.equal(videoJob.content_table, 'videos')
    const showJob = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/s1/ep.mp4?dl=0', title: 'Episode 1', destination: 'show', seriesId: 11, seasonId: 30 })
    assert.equal(showJob.content_table, 'episodes')
  }
  // A rejected Bunny fetch fails loudly and stores nothing.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny({ fetchFails: 1 })
    await assert.rejects(() => core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/f/x.mp4?dl=0', title: 'X', destination: 'video' }), /Bunny rejected/)
    assert.equal(store.jobs.length, 0)
    assert.equal(store.content.videos.length, 0)
  }
  // Teaching/show without a series+season, and empty titles, are rejected.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    await assert.rejects(() => core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/t/x.mp4?dl=0', title: 'X', destination: 'teaching' }), /series/i)
    await assert.rejects(() => core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/t/x.mp4?dl=0', title: '  ', destination: 'video' }), /title/i)
  }
  console.log('CORE_CREATE_OK: valid ingests call Bunny fetch and file content under the right section immediately')

  // refreshIngestJobs discovers the fetched video (fetch returns no GUID), attaches it
  // to the content row, then tracks Bunny's pipeline until completion or failure.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const job = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/abc123/sermon.mp4?dl=0', title: 'Easter Sermon', destination: 'sermon' })
    await core.refreshIngestJobs(store, bunny)
    const discovered = await store.getJob(job.id)
    assert.equal(discovered.bunny_video_id, 'guid-1')
    assert.equal(store.content.entertainments[0].bunny_video_url, 'guid-1')
    assert.equal(store.content.entertainments[0].video_upload_type, 'bunny')
    // Transcoding progress flows into the job.
    bunny.state.videos[0].status = 3
    bunny.state.videos[0].encodeProgress = 50
    await core.refreshIngestJobs(store, bunny)
    let current = await store.getJob(job.id)
    assert.equal(current.phase, 'transcoding')
    assert.equal(current.progress, 60)
    assert.equal(current.bunny_status, 3)
    // Completion lands at 100%.
    bunny.state.videos[0].status = 4
    bunny.state.videos[0].encodeProgress = 100
    bunny.state.videos[0].length = 1830
    await core.refreshIngestJobs(store, bunny)
    current = await store.getJob(job.id)
    assert.equal(current.phase, 'complete')
    assert.equal(current.progress, 100)
  }
  // Two same-title ingests never claim the same Bunny video.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const first = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/a/x.mp4?dl=0', title: 'Same Title', destination: 'video' })
    const second = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/b/x.mp4?dl=0', title: 'Same Title', destination: 'video' })
    await core.refreshIngestJobs(store, bunny)
    const claimed = [(await store.getJob(first.id)).bunny_video_id, (await store.getJob(second.id)).bunny_video_id]
    assert.ok(claimed[0] && claimed[1] && claimed[0] !== claimed[1])
  }
  // Nothing discovered yet: the job waits in fetching without an error.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    bunny.state.videos.length = 0
    const job = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/w/x.mp4?dl=0', title: 'Waiting', destination: 'video' })
    bunny.state.videos.length = 0 // fetch queued at Bunny but not visible yet
    await core.refreshIngestJobs(store, bunny)
    const waiting = await store.getJob(job.id)
    assert.equal(waiting.phase, 'fetching')
    assert.equal(waiting.error, null)
  }
  // Bunny transcoding errors surface verbatim on the job.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const job = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/e/x.mp4?dl=0', title: 'Broken', destination: 'video' })
    bunny.state.videos[0].status = 5
    bunny.state.videos[0].transcodingMessages = [{ level: 3, message: 'Original file is corrupted' }]
    await core.refreshIngestJobs(store, bunny)
    const failed = await store.getJob(job.id)
    assert.equal(failed.phase, 'failed')
    assert.equal(failed.error, 'Original file is corrupted')
  }
  console.log('CORE_REFRESH_OK: guid discovery, transcoding progress, completion and failure all tracked')

  // cancelIngestJob deletes the Bunny video and the content row; retry re-queues a failure.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const job = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/c/x.mp4?dl=0', title: 'Cancel Me', destination: 'video' })
    await core.refreshIngestJobs(store, bunny)
    await core.cancelIngestJob(store, bunny, job.id)
    assert.deepEqual(bunny.calls.deleteVideo, ['guid-1'])
    assert.ok(store.content.videos[0].deleted_at)
    assert.equal((await store.getJob(job.id)).phase, 'cancelled')

    const failed = await core.createIngestJob(store, bunny, { url: 'https://www.dropbox.com/s/r/x.mp4?dl=0', title: 'Retry Me', destination: 'video' })
    bunny.state.videos.find(v => v.guid === 'guid-2').status = 6
    await core.refreshIngestJobs(store, bunny)
    assert.equal((await store.getJob(failed.id)).phase, 'failed')
    await core.retryIngestJob(store, bunny, failed.id)
    const retried = await store.getJob(failed.id)
    assert.equal(retried.phase, 'fetching')
    assert.equal(retried.progress, 0)
    assert.equal(retried.error, null)
    assert.equal(retried.bunny_video_id, null)
    assert.equal(bunny.calls.fetchVideo.length, 3)
  }
  console.log('CORE_CANCEL_RETRY_OK: cancel deletes remote video and content, retry re-queues a failed ingest')

  // Teaching/show ingests can create the series and season/volume on the fly.
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const job = await core.createIngestJob(store, bunny, {
      url: 'https://www.dropbox.com/s/n1/lesson.mp4?dl=0', title: 'Lesson 1',
      destination: 'teaching', newSeriesTitle: 'Book of Romans', newSeasonTitle: 'Volume 1',
    })
    const series = store.content.entertainments[0]
    assert.equal(series.type, 'teaching')
    assert.equal(series.name, 'Book of Romans')
    const season = store.content.seasons[0]
    assert.equal(season.entertainment_id, series.id)
    assert.equal(season.name, 'Volume 1')
    const episode = store.content.episodes[0]
    assert.equal(episode.entertainment_id, series.id)
    assert.equal(episode.season_id, season.id)
    assert.equal(job.series_id, series.id)
    assert.equal(job.season_id, season.id)
  }
  console.log('CORE_NEW_SERIES_OK: on-the-fly series and season/volume creation chains into the episode')

  // ---------- Part 2: real route + widget in a browser against the fixture store ----------
  const entry = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { Route } from './src/routes/admin/media-ingest'
    import { ToastProvider } from './src/lib/toast'
    import { ConfirmProvider } from './src/lib/confirm'
    import { IngestProvider } from './src/lib/ingest'
    import { IngestWidget } from './src/components/IngestWidget'
    const Page = Route.component
    createRoot(document.getElementById('app')).render(
      <ToastProvider><ConfirmProvider><IngestProvider><Page /><IngestWidget /></IngestProvider></ConfirmProvider></ToastProvider>
    )
  `
  await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, outdir: temporary, platform: 'browser', format: 'esm', jsx: 'automatic',
    plugins: [boundaryStubs],
  })
  const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:16px system-ui;background:#090b12;color:#e5e7eb;margin:0;padding:24px}input,select,button{font:inherit;padding:8px}label{display:block;font-size:13px;margin-bottom:4px}img{max-width:100%}</style>
    </head><body><div id="app"></div>
    <script type="module">
      import { createMemoryIngestStore, createScriptedBunny } from '/doubles.mjs'
      window.__INGEST_POLL_MS__ = 250
      window.store = createMemoryIngestStore()
      window.bunny = createScriptedBunny()
      window.ingestStore = {
        deps: () => ({ store: window.store, bunny: window.bunny }),
        formOptions: {
          configured: true,
          shows: [{ id: 11, name: 'Halobox Talks' }],
          teachings: [{ id: 12, name: 'Faith Foundations' }],
          seasons: [
            { id: 30, name: 'Season 1', entertainment_id: 11 },
            { id: 31, name: 'Volume 1', entertainment_id: 12 },
          ],
        },
      }
      window.fixtureLoaderData = () => ({
        jobsRes: { configured: true, libraryId: '347005', jobs: [] },
        options: window.ingestStore.formOptions,
      })
    </script>
    <script type="module" src="/stdin.js"></script></body></html>`
  const doubles = readFileSync(path.join(process.cwd(), 'scripts', 'ingest-test-doubles.mjs'))
  server = createServer((req, res) => {
    if (req.url === '/stdin.js') { res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(path.join(temporary, 'stdin.js'))); return }
    if (req.url === '/stdin.css') {
      const css = path.join(temporary, 'stdin.css')
      res.setHeader('content-type', 'text/css'); res.end(existsSync(css) ? readFileSync(css) : ''); return
    }
    if (req.url === '/doubles.mjs') { res.setHeader('content-type', 'text/javascript'); res.end(doubles); return }
    res.setHeader('content-type', 'text/html'); res.end(harness)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const jobsSection = page.locator('section[aria-label="Ingest jobs"]')
  const widget = page.getByRole('complementary', { name: 'Media ingest progress' })

  // Invalid links are rejected inline before Bunny is touched.
  await page.getByLabel('Dropbox shared link').fill('https://example.com/v.mp4')
  await page.getByLabel('Title').fill('Nope')
  await page.getByRole('button', { name: 'Start ingest' }).click()
  const formAlert = page.locator('form').getByRole('alert')
  await formAlert.waitFor()
  assert.match(await formAlert.textContent(), /valid Dropbox/)
  assert.equal(await page.evaluate(() => window.bunny.calls.fetchVideo.length), 0)
  console.log('UI_VALIDATE_OK: invalid links rejected inline, Bunny untouched')

  // A valid sermon ingest starts immediately; the floating widget mirrors it.
  await page.getByLabel('Dropbox shared link').fill('https://www.dropbox.com/s/abc123/sermon.mp4?dl=0')
  await page.getByLabel('Title').fill('Easter Sermon')
  await page.getByRole('button', { name: 'Start ingest' }).click()
  await jobsSection.getByText('Fetching from Dropbox…').waitFor()
  await widget.getByText('Easter Sermon').waitFor()
  assert.equal(await page.evaluate(() => window.store.content.entertainments[0]?.name), 'Easter Sermon')
  console.log('UI_START_OK: sermon ingest starts, content filed, floating widget mirrors the job')

  // Bunny transcoding progress flows into both surfaces.
  await page.evaluate(() => { const v = window.bunny.state.videos[0]; v.status = 3; v.encodeProgress = 50 })
  await jobsSection.getByText('Transcoding on Bunny Stream…').waitFor()
  await widget.getByText('60%', { exact: true }).waitFor()
  console.log('UI_TRANSCODE_OK: transcoding phase and percentage render on page and widget')

  // Completion swaps the card for the embed snippet, duration and resolutions.
  await page.evaluate(() => { const v = window.bunny.state.videos[0]; v.status = 4; v.encodeProgress = 100; v.length = 1830; v.availableResolutions = '360p,720p,1080p' })
  await jobsSection.getByText(/iframe\.mediadelivery\.net\/embed\/347005\/guid-1/).waitFor()
  await jobsSection.getByText(/30:30/).waitFor()
  await jobsSection.getByText(/360p,720p,1080p/).waitFor()
  await widget.getByText('Complete').waitFor()
  await widget.getByRole('button', { name: 'Dismiss Easter Sermon' }).click()
  await page.waitForFunction(() => !document.querySelector('aside[aria-label="Media ingest progress"]'))
  console.log('UI_COMPLETE_OK: embed snippet, duration, resolutions; widget dismisses after completion')

  // Cancel asks for confirmation, deletes the Bunny video and soft-deletes the content row.
  await page.getByLabel('Dropbox shared link').fill('https://www.dropbox.com/s/c1/cancel.mp4?dl=0')
  await page.getByLabel('Title').fill('Cancel Me')
  await page.getByLabel('Destination').selectOption('video')
  await page.getByRole('button', { name: 'Start ingest' }).click()
  await jobsSection.getByText('Cancel Me').waitFor()
  await jobsSection.getByRole('button', { name: 'Cancel ingest of Cancel Me' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel ingest', exact: true }).click()
  await page.waitForFunction(() => window.bunny.calls.deleteVideo.includes('guid-2'))
  assert.ok(await page.evaluate(() => window.store.content.videos[0].deleted_at), 'content row soft-deleted on cancel')
  console.log('UI_CANCEL_OK: confirm dialog, Bunny delete and content soft-delete on cancel')

  // Bunny failures surface verbatim; retry re-fetches and returns to fetching.
  await page.getByLabel('Dropbox shared link').fill('https://www.dropbox.com/s/r1/retry.mp4?dl=0')
  await page.getByLabel('Title').fill('Retry Me')
  await page.getByRole('button', { name: 'Start ingest' }).click()
  await jobsSection.getByText('Retry Me').waitFor()
  await page.evaluate(() => {
    const v = window.bunny.state.videos.find(video => video.guid === 'guid-3')
    v.status = 5
    v.transcodingMessages = [{ level: 3, message: 'Original file is corrupted' }]
  })
  await jobsSection.getByText(/Original file is corrupted/).waitFor()
  await jobsSection.getByRole('button', { name: 'Retry ingest of Retry Me' }).click()
  await page.waitForFunction(() => window.bunny.calls.fetchVideo.length === 4)
  await page.waitForFunction(() => window.store.jobs.find(j => j.title === 'Retry Me').phase === 'fetching')
  console.log('UI_RETRY_OK: Bunny error message shown, retry re-fetches and resets the job')

  // Teaching episodes can create their volume and season on the fly from the form.
  await page.getByLabel('Dropbox shared link').fill('https://www.dropbox.com/s/n1/lesson.mp4?dl=0')
  await page.getByLabel('Title').fill('Lesson 1')
  await page.getByLabel('Destination').selectOption('teaching')
  await page.getByLabel('Teaching volume').selectOption('new')
  await page.getByLabel('New volume title').fill('Book of Romans')
  await page.getByLabel('New season title').fill('Volume 2')
  await page.getByRole('button', { name: 'Start ingest' }).click()
  await page.waitForFunction(() => window.store.content.entertainments.some(e => e.name === 'Book of Romans' && e.type === 'teaching'))
  const chain = await page.evaluate(() => ({ seasons: window.store.content.seasons, episodes: window.store.content.episodes }))
  assert.equal(chain.seasons[0].name, 'Volume 2')
  assert.equal(chain.episodes[0].name, 'Lesson 1')
  assert.equal(chain.episodes[0].season_id, chain.seasons[0].id)
  console.log('UI_NEW_SERIES_OK: new volume and season created from the form chain into the episode')

  assert.deepEqual(errors, [])
  console.log('MEDIA_INGEST_GATE_OK')
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
  rmSync(temporary, { recursive: true, force: true })
}
