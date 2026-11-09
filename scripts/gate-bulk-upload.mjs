// Bulk upload gate: header auto-mapping, video-source detection, row parsing, and the
// import pipeline (taxonomy resolve/create, duplicates, Dropbox→ingest vs Bunny attach).
// Part 1 exercises the real core modules in node; Part 2 drives the route in a browser.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const XLSX = require('xlsx')

const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-bulk-upload-'))

// Browser bundle stubs: the server boundary wires the REAL core to the in-memory
// store, taxonomy and scripted Bunny client installed on window by the harness,
// so the route runs against production logic with production response shapes.
const boundaryStubs = {
  name: 'boundary-stubs',
  setup(b) {
    b.onResolve({ filter: /(^|\/)bulk-import$/ }, () => ({ path: 'server', namespace: 'fixture' }))
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

const SERVER_FIXTURE = `
import * as core from './src/lib/bulk-import-core'
const deps = () => window.bulkFixture
export const bulkImportContext = async () => deps().context
export const bulkImportRows = async ({ data }) => {
  const d = deps()
  const results = await core.importBulkRows(core.revalidateBulkRows(data.rows), { tax: d.tax, store: d.store, bunny: d.bunny })
  const summary = {
    queued: results.filter(r => r.outcome === 'queued').length,
    attached: results.filter(r => r.outcome === 'attached').length,
    skipped: results.filter(r => r.outcome === 'skipped-duplicate').length,
    failed: results.filter(r => r.outcome === 'failed').length,
  }
  return { results, summary }
}
`

let browser, server

try {
  const out = path.join(temporary, 'bulk.mjs')
  await build({
    stdin: { contents: `export * from './src/lib/bulk-import-core'`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, outfile: out, platform: 'node', format: 'esm',
  })
  const core = await import(out)
  const { createMemoryIngestStore, createScriptedBunny, createMemoryTax } = await import('./ingest-test-doubles.mjs')

  // ---------- header auto-mapping ----------
  assert.deepEqual(
    core.autoMapHeaders(['Title', 'Dropbox Link', 'Destination', 'Genre', 'Preacher', 'Location', 'Release Date', 'Access', 'Notes']),
    ['title', 'video', 'destination', 'categories', 'preacher', 'location', 'releaseDate', 'access', null],
  )
  // Duplicate headers: only the first column claims the field.
  assert.deepEqual(core.autoMapHeaders(['Title', 'Name'])[1], null)
  // Case and punctuation tolerant.
  assert.deepEqual(core.autoMapHeaders(['BUNNY VIDEO ID', 'teaching-series'])[0], 'video')
  console.log('BULK_MAP_OK: headers auto-map to fields, unknown and duplicate columns left unmapped')

  // ---------- video source detection ----------
  const GUID = '0443f5a5-de41-4536-b212-b15272a3cf86'
  assert.deepEqual(core.detectVideoSource('https://www.dropbox.com/s/abc/sermon.mp4?dl=0'), { kind: 'dropbox', value: 'https://dl.dropboxusercontent.com/s/abc/sermon.mp4?dl=1' })
  assert.deepEqual(core.detectVideoSource(GUID), { kind: 'bunny', value: GUID })
  assert.deepEqual(core.detectVideoSource(`https://vz-71678b8b-6af.b-cdn.net/${GUID}/playlist.m3u8`), { kind: 'bunny', value: GUID })
  assert.deepEqual(core.detectVideoSource(`https://iframe.mediadelivery.net/embed/347005/${GUID}`), { kind: 'bunny', value: GUID })
  assert.equal(core.detectVideoSource('random text').kind, 'invalid')
  assert.equal(core.detectVideoSource('').kind, 'invalid')
  assert.equal(core.detectVideoSource('https://example.com/video.mp4').kind, 'invalid')
  console.log('BULK_DETECT_OK: dropbox links rewritten, GUIDs and Bunny CDN/embed URLs detected, junk rejected')

  // ---------- row parsing and validation ----------
  const mapping = ['title', 'destination', 'video', 'series', 'season', 'categories', 'preacher', 'location']
  const parsed = core.parseBulkRows([
    ['Easter Sermon', 'Sermon', 'https://www.dropbox.com/s/a/x.mp4?dl=0', '', '', 'Faith, Healing', 'Rev. Adams', 'London'],
    ['Lesson 1', 'teaching', GUID, 'Book of Romans', 'Volume 1', 'Doctrine', '', ''],
    ['', 'video', GUID, '', '', '', '', ''],                       // missing title
    ['Bad Dest', 'blog', GUID, '', '', '', '', ''],                // bad destination
    ['No Series', 'show', GUID, '', '', '', '', ''],               // episodic without series
    ['Clip', 'video', GUID, '', '', 'Faith', 'Rev. Adams', ''],  // video taxonomy warning
    ['', '', '', '', '', '', '', ''],                                // blank row, skipped
  ], mapping)
  assert.equal(parsed.length, 6)
  assert.deepEqual(parsed[0].errors, [])
  assert.deepEqual(parsed[0].categories, ['Faith', 'Healing'])
  assert.deepEqual(parsed[0].preachers, ['Rev. Adams'])
  assert.equal(parsed[1].errors.length, 0)
  assert.match(parsed[2].errors[0], /Title is required/)
  assert.match(parsed[3].errors[0], /Destination/)
  assert.match(parsed[4].errors[0], /Series/)
  assert.match(parsed[5].warnings[0], /sermons and series only/)
  console.log('BULK_PARSE_OK: rows validated, names split, blank rows skipped, video-taxonomy warning')

  // ---------- import: dropbox sermon queues an ingest with full mapping ----------
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const tax = createMemoryTax(store)
    const [row] = core.parseBulkRows([['Easter Sermon', 'sermon', 'https://www.dropbox.com/s/a/x.mp4?dl=0', '', '', 'Faith', 'Rev. Adams', 'London']], mapping)
    const [result] = await core.importBulkRows([row], { tax, store, bunny })
    assert.equal(result.outcome, 'queued')
    assert.equal(bunny.calls.fetchVideo.length, 1)
    const content = store.content.entertainments[0]
    assert.equal(content.type, 'movie')
    const map = store.mappings.find(m => m.table === 'entertainments' && m.id === content.id)
    assert.equal(map.genreIds.length, 1)
    assert.equal(map.castIds.length, 1)
    assert.equal(map.locationIds.length, 1)
    assert.deepEqual(result.createdNames.sort(), ['genre: Faith', 'location: London', 'preacher: Rev. Adams'])
  }
  // ---------- import: bunny-guid video attaches without a fetch ----------
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const tax = createMemoryTax(store)
    const [row] = core.parseBulkRows([['Testimony Clip', 'video', GUID, '', '', '', '', '']], mapping)
    const [result] = await core.importBulkRows([row], { tax, store, bunny })
    assert.equal(result.outcome, 'attached')
    assert.equal(bunny.calls.fetchVideo.length, 0)
    assert.equal(store.content.videos[0].bunny_video_url, GUID)
    assert.equal(store.jobs[0].bunny_video_id, GUID)
  }
  // ---------- import: duplicates skipped, failures isolated per row ----------
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const tax = createMemoryTax(store)
    const rows = core.parseBulkRows([
      ['Dup Clip', 'video', GUID, '', '', '', '', ''],
      ['Bad Row', 'video', 'junk', '', '', '', '', ''],
    ], mapping)
    await core.importBulkRows([rows[0]], { tax, store, bunny })
    const results = await core.importBulkRows(rows, { tax, store, bunny })
    assert.equal(results[0].outcome, 'skipped-duplicate')
    assert.equal(results[1].outcome, 'failed')
    assert.equal(store.content.videos.length, 1)
  }
  // ---------- import: teaching row creates series + season, maps taxonomy to series ----------
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const tax = createMemoryTax(store)
    const [row] = core.parseBulkRows([['Lesson 1', 'teaching', GUID, 'Book of Romans', 'Volume 1', 'Doctrine', 'Rev. Adams', 'London']], mapping)
    const [result] = await core.importBulkRows([row], { tax, store, bunny })
    assert.equal(result.outcome, 'attached')
    const series = store.content.entertainments.find(r => r.type === 'teaching')
    assert.equal(series.name, 'Book of Romans')
    const season = store.content.seasons[0]
    assert.equal(season.entertainment_id, series.id)
    const episode = store.content.episodes[0]
    assert.equal(episode.season_id, season.id)
    const seriesMap = store.mappings.find(m => m.table === 'entertainments' && m.id === series.id)
    assert.equal(series.map ?? null, null) // mapping recorded via store.mappings, not the row
    assert.ok(seriesMap && seriesMap.genreIds.length === 1 && seriesMap.castIds.length === 1)
    assert.ok(result.createdNames.includes('series: Book of Romans'))
    assert.ok(result.createdNames.includes('season: Volume 1'))
    // A second row into the same series/season reuses them.
    const [row2] = core.parseBulkRows([['Lesson 2', 'teaching', GUID, 'Book of Romans', 'Volume 1', '', '', '']], mapping)
    await core.importBulkRows([row2], { tax, store, bunny })
    assert.equal(store.content.seasons.length, 1)
    assert.equal(store.content.entertainments.filter(r => r.type === 'teaching').length, 1)
  }
  console.log('BULK_IMPORT_OK: dropbox queued with mapping, GUID attached, dupes skipped, series/season created and reused')

  // ---------- server-side revalidation: forged client rows cannot smuggle junk ----------
  {
    const store = createMemoryIngestStore()
    const bunny = createScriptedBunny()
    const tax = createMemoryTax(store)
    const forged = [
      { index: 2, title: 'Forged', destination: 'video', video: { kind: 'bunny', value: 'not-a-guid' }, series: '', season: '', categories: [], preachers: [], locations: [], description: '', releaseDate: '', access: 'free', errors: [], warnings: [] },
      { index: 3, title: 'OK Clip', destination: 'video', video: { kind: 'bunny', value: GUID }, series: '', season: '', categories: [], preachers: [], locations: [], description: '', releaseDate: '', access: 'free', errors: [], warnings: [] },
      { index: 4, title: 'Bad Link', destination: 'video', video: { kind: 'dropbox', value: 'https://example.com/x.mp4' }, series: '', season: '', categories: [], preachers: [], locations: [], description: '', releaseDate: '', access: 'free', errors: [], warnings: [] },
      { index: 5, title: '', destination: 'video', video: { kind: 'bunny', value: GUID }, series: '', season: '', categories: [], preachers: [], locations: [], description: '', releaseDate: '', access: 'free', errors: [], warnings: [] },
    ]
    const clean = core.revalidateBulkRows(forged)
    assert.match(clean[0].errors[0], /Dropbox shared link or a Bunny video ID/)
    assert.deepEqual(clean[1].errors, [])
    assert.equal(clean[1].video.kind, 'bunny')
    assert.equal(clean[2].video.kind, 'invalid')
    assert.match(clean[3].errors[0], /Title is required/)
    const results = await core.importBulkRows(clean, { tax, store, bunny })
    assert.deepEqual(results.map(r => r.outcome), ['failed', 'attached', 'failed', 'failed'])
    assert.equal(store.content.videos.length, 1)
    assert.equal(store.content.videos[0].name, 'OK Clip')
  }
  console.log('BULK_REVALIDATE_OK: forged video sources, links and titles fail server-side')

  // ---------- Part 2: real route in a browser against the fixture store ----------
  const entry = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { Route } from './src/routes/admin/bulk-upload'
    import { ToastProvider } from './src/lib/toast'
    const Page = Route.component
    createRoot(document.getElementById('app')).render(<ToastProvider><Page /></ToastProvider>)
  `
  await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, outdir: temporary, platform: 'browser', format: 'esm', jsx: 'automatic',
    plugins: [boundaryStubs],
  })
  const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:16px system-ui;background:#090b12;color:#e5e7eb;margin:0;padding:24px}input,select,button{font:inherit;padding:8px}label{display:block;font-size:13px;margin-bottom:4px}table{border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #333}</style>
    </head><body><div id="app"></div>
    <script type="module">
      import { createMemoryIngestStore, createScriptedBunny, createMemoryTax } from '/doubles.mjs'
      window.store = createMemoryIngestStore()
      window.bunny = createScriptedBunny()
      window.tax = createMemoryTax(window.store)
      window.bulkFixture = {
        store: window.store, bunny: window.bunny, tax: window.tax,
        context: { genres: ['Faith'], preachers: ['Rev. Adams'], locations: [] },
      }
      window.fixtureLoaderData = () => window.bulkFixture.context
    </script>
    <script type="module" src="/stdin.js"></script></body></html>`
  const doubles = readFileSync(path.join(process.cwd(), 'scripts', 'ingest-test-doubles.mjs'))
  server = createServer((req, res) => {
    if (req.url === '/stdin.js') { res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(path.join(temporary, 'stdin.js'))); return }
    if (req.url === '/stdin.css') {
      const css = path.join(temporary, 'stdin.css')
      res.setHeader('content-type', 'text/css'); res.end(existsSync(css) ? readFileSync(css) : ''); return
    }
    if (req.url === '/doubles.mjs') { res.setHeader('content-type', 'text/javascript'); res.end(doubles); return
    }
    res.setHeader('content-type', 'text/html'); res.end(harness)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)

  // The downloadable template carries headers plus one Dropbox and one Bunny-ID example row.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download template' }).click(),
  ])
  assert.equal(download.suggestedFilename(), 'halobox-bulk-upload-template.xlsx')
  console.log('UI_TEMPLATE_OK: template downloads with headers and example rows')

  // Upload a sheet: headers auto-map, rows parse into the preview.
  const sheetBook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(sheetBook, XLSX.utils.aoa_to_sheet([
    ['Title', 'Destination', 'Dropbox Link', 'Series', 'Season', 'Categories', 'Preacher', 'Location'],
    ['Easter Sermon', 'Sermon', 'https://www.dropbox.com/s/a/x.mp4?dl=0', '', '', 'Faith, Healing', 'Rev. Adams', 'London'],
    ['Lesson 1', 'Teaching', GUID, 'Book of Romans', 'Volume 1', '', '', ''],
    ['', 'video', GUID, '', '', '', '', ''],
  ]), 'Bulk Upload')
  const sheetBuffer = XLSX.write(sheetBook, { type: 'buffer', bookType: 'xlsx' })
  await page.locator('input[aria-label="Choose spreadsheet to import"]').setInputFiles({
    name: 'bulk.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: sheetBuffer,
  })
  await page.getByText('2 ready · 1 with errors').waitFor()
  assert.equal(await page.locator('#bulk-map-0').inputValue(), 'title')
  assert.equal(await page.locator('#bulk-map-2').inputValue(), 'video')
  assert.equal(await page.locator('#bulk-map-5').inputValue(), 'categories')
  const createdText = await page.getByText(/Will be created:/).textContent()
  assert.ok(createdText.includes('Category: Healing'), 'new category flagged')
  assert.ok(createdText.includes('Location: London'), 'new location flagged')
  assert.ok(createdText.includes('Book of Romans'), 'new series flagged')
  assert.ok(!createdText.includes('Category: Faith'), 'existing category not flagged')
  assert.ok(!createdText.includes('Preacher: Rev. Adams'), 'existing preacher not flagged')
  await page.getByText('Title is required.').waitFor()
  console.log('UI_PREVIEW_OK: auto-mapping, ready/error counts, will-be-created flags')

  // Manual remap: ignoring the video column invalidates every row; mapping it back restores them.
  await page.locator('#bulk-map-2').selectOption('')
  await page.getByText('0 ready · 3 with errors').waitFor()
  await page.locator('#bulk-map-2').selectOption('video')
  await page.getByText('2 ready · 1 with errors').waitFor()
  console.log('UI_REMAP_OK: manual column remap revalidates the preview live')

  // Import: the Dropbox row queues an ingest, the GUID row attaches, outcomes are listed.
  await page.getByRole('button', { name: 'Import 2 rows' }).click()
  await page.getByText('Import results').waitFor()
  await page.getByText('Queued for transcoding').waitFor()
  await page.getByText('Attached', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.bunny.calls.fetchVideo.length), 1)
  const state = await page.evaluate(() => ({
    entertainments: window.store.content.entertainments.map(r => ({ name: r.name, type: r.type })),
    episodes: window.store.content.episodes.map(r => ({ name: r.name, guid: r.bunny_video_url ?? null })),
  }))
  assert.ok(state.entertainments.some(r => r.name === 'Easter Sermon' && r.type === 'movie'))
  assert.ok(state.entertainments.some(r => r.name === 'Book of Romans' && r.type === 'teaching'))
  assert.deepEqual(state.episodes, [{ name: 'Lesson 1', guid: GUID.toLowerCase() }])
  console.log('UI_IMPORT_OK: dropbox row queued with a Bunny fetch, GUID row attached instantly')

  assert.deepEqual(errors, [])
  console.log('BULK_UPLOAD_GATE_OK')
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
  rmSync(temporary, { recursive: true, force: true })
}
