import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const selfTest = process.argv.includes('--self-test')

const NAV_ROUTES = [
  ['/admin', 'src/routes/admin/index.tsx'],
  ['/admin/media-library', 'src/routes/admin/media-library.tsx'],
  ['/admin/genres', 'src/routes/admin/genres.tsx'],
  ['/admin/movies', 'src/routes/admin/movies.tsx'],
  ['/admin/tv-shows', 'src/routes/admin/tv-shows.tsx'],
  ['/admin/series', 'src/routes/admin/series.tsx'],
  ['/admin/episodes', 'src/routes/admin/episodes.tsx'],
  ['/admin/teaching', 'src/routes/admin/teaching.tsx'],
  ['/admin/teaching-volumes', 'src/routes/admin/teaching-volumes.tsx'],
  ['/admin/teaching-episodes', 'src/routes/admin/teaching-episodes.tsx'],
  ['/admin/videos', 'src/routes/admin/videos.tsx'],
  ['/admin/tv-category', 'src/routes/admin/tv-category.tsx'],
  ['/admin/live-tv', 'src/routes/admin/live-tv.tsx'],
  ['/admin/actors', 'src/routes/admin/actors.tsx'],
  ['/admin/directors', 'src/routes/admin/directors.tsx'],
  ['/admin/vast-ads', 'src/routes/admin/vast-ads.tsx'],
  ['/admin/custom-ads', 'src/routes/admin/custom-ads.tsx'],
  ['/admin/subscriptions', 'src/routes/admin/subscriptions.tsx'],
  ['/admin/plans', 'src/routes/admin/plans.tsx'],
  ['/admin/plan-limits', 'src/routes/admin/plan-limits.tsx'],
  ['/admin/rent-history', 'src/routes/admin/rent-history.tsx'],
  ['/admin/coupons', 'src/routes/admin/coupons.tsx'],
  ['/admin/users', 'src/routes/admin/users.tsx'],
  ['/admin/soon-to-expire', 'src/routes/admin/soon-to-expire.tsx'],
  ['/admin/banners', 'src/routes/admin/banners.tsx'],
  ['/admin/constants', 'src/routes/admin/constants.tsx'],
  ['/admin/notification-templates', 'src/routes/admin/notification-templates.tsx'],
  ['/admin/settings', 'src/routes/admin/settings.tsx'],
  ['/admin/pages', 'src/routes/admin/pages.tsx'],
  ['/admin/onboarding', 'src/routes/admin/onboarding.tsx'],
  ['/admin/tax', 'src/routes/admin/tax.tsx'],
  ['/admin/faq', 'src/routes/admin/faq.tsx'],
  ['/admin/language', 'src/routes/admin/language.tsx'],
  ['/admin/world', 'src/routes/admin/world.tsx'],
  ['/admin/currency', 'src/routes/admin/currency.tsx'],
  ['/admin/countries', 'src/routes/admin/countries.tsx'],
  ['/admin/access-control', 'src/routes/admin/access-control.tsx'],
]
const ALL_ROUTES = [...NAV_ROUTES, ['/admin/user/$id', 'src/routes/admin/user.$id.tsx']]
const NEWER_FILES = [
  'src/components/AdminDataTable.tsx',
  'src/components/SeriesAdmin.tsx',
  'src/components/ui/approval-card.tsx',
  'src/components/ui/file-upload-card.tsx',
  'src/components/ui/halo-notification.tsx',
  'src/lib/account-media.server.ts',
  'src/lib/bunny.ts',
  'src/lib/confirm.tsx',
  'src/lib/series-validation.ts',
  'src/lib/toast.tsx',
  'src/routes/admin/series.tsx',
  'src/routes/admin/settings.tsx',
  'src/routes/admin/teaching-episodes.tsx',
  'src/routes/admin/teaching-volumes.tsx',
  'src/routes/admin/teaching.tsx',
  'src/routes/admin/user.$id.tsx',
  'src/routes/api/account-media/$.ts',
  'src/routes/api/bunny-upload.ts',
]
const INSPECTED_FILES = [...new Set([
  ...ALL_ROUTES.map(([, file]) => file),
  ...NEWER_FILES,
  'src/components/admin-content.tsx',
  'src/lib/admin.ts',
  'src/routeTree.gen.ts',
  'src/routes/admin.tsx',
  'src/routes/api/upload.ts',
  'src/styles.css',
  'wrangler.jsonc',
])]

function walk(directory, prefix = '') {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory()
      ? walk(path.join(directory, entry.name), relative)
      : [relative]
  })
}

function readSnapshot(root) {
  const files = {}
  for (const file of INSPECTED_FILES) {
    try {
      files[file] = readFileSync(path.join(root, file), 'utf8')
    } catch {
      files[file] = null
    }
  }
  return { files, sourceFiles: walk(path.join(root, 'src'), 'src') }
}

function evaluate(snapshot) {
  const failures = []
  let checks = 0
  const check = (condition, message) => {
    checks += 1
    if (!condition) failures.push(message)
  }
  const includes = (file, text) => snapshot.files[file]?.includes(text) ?? false
  const routeTree = snapshot.files['src/routeTree.gen.ts'] ?? ''
  const adminLayout = snapshot.files['src/routes/admin.tsx'] ?? ''

  check(NAV_ROUTES.length === 37 && ALL_ROUTES.length === 38, 'Verifier route manifest must contain 37 nav URLs and 38 total URLs')
  for (const [url, file] of ALL_ROUTES) {
    check(snapshot.files[file] !== null, `Missing route artifact for ${url}: ${file}`)
    check(routeTree.includes(`'${url}'`) || (url === '/admin' && routeTree.includes("'/admin/'")), `Generated route tree does not represent ${url}`)
  }
  for (const [url] of NAV_ROUTES) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    check(new RegExp(`to:\\s*['"]${escaped}['"]`).test(adminLayout), `Admin navigation does not represent ${url}`)
  }
  for (const file of ['src/routes/admin/reviews.tsx', 'src/routes/admin/seasons.tsx']) {
    check(!snapshot.sourceFiles.includes(file), `Obsolete route still exists: ${file}`)
  }
  for (const file of NEWER_FILES) {
    check(typeof snapshot.files[file] === 'string' && snapshot.files[file].length > 0, `Missing recovered newer file: ${file}`)
  }

  const admin = snapshot.files['src/lib/admin.ts'] ?? ''
  for (const text of [
    "type='teaching'", "'teaching-volumes'", "'teaching-episodes'",
    'isSeriesEntity', 'assertGroupedRecord', 'validateGroupedValues',
    'adminGetSettings', 'adminSaveSetting', 'adminUpsertSetting', 'adminTestNovu',
    'novu_api_key', 'novu_application_id', 'novu_backend_url',
    'adminListR2Media', 'adminDeleteR2Object', 'normalizeBunnyFields',
    'adminBunnyStatus', 'adminBunnyListVideos',
  ]) check(admin.includes(text), `Recovered admin server code is missing ${text}`)

  const settings = snapshot.files['src/routes/admin/settings.tsx'] ?? ''
  for (const text of ['adminTestNovu', 'novu_api_key', 'novu_application_id', 'novu_backend_url']) {
    check(settings.includes(text), `Settings UI is missing ${text}`)
  }
  const accountMedia = snapshot.files['src/lib/account-media.server.ts'] ?? ''
  for (const text of ['isPublicMediaKey', 'serveAccountMedia', 'private/', 'user_multi_profiles']) {
    check(accountMedia.includes(text), `Account media server code is missing ${text}`)
  }
  const bunny = snapshot.files['src/lib/bunny.ts'] ?? ''
  for (const text of ['parseBunnyVideo', 'directVideoUrl', 'resolveVideoPlayback', 'normalizeBunnyFields', 'selectedEpisode']) {
    check(bunny.includes(text), `Bunny server helpers are missing ${text}`)
  }
  const bunnyUpload = snapshot.files['src/routes/api/bunny-upload.ts'] ?? ''
  check(bunnyUpload.includes('video.bunnycdn.com'), 'Bunny upload endpoint is missing the Bunny Stream API integration')
  const upload = snapshot.files['src/routes/api/upload.ts'] ?? ''
  check(upload.includes('MEDIA.put'), 'R2 upload endpoint no longer writes through the MEDIA binding')
  const accountRoute = snapshot.files['src/routes/api/account-media/$.ts'] ?? ''
  check(accountRoute.includes('serveAccountMedia') && accountRoute.includes('MEDIA'), 'Account media route no longer uses protected R2 media')

  let wrangler = null
  try {
    wrangler = JSON.parse(snapshot.files['wrangler.jsonc'] ?? '')
  } catch {
    failures.push('wrangler.jsonc is missing or is not valid JSON for the baseline configuration')
  }
  checks += 1
  check(Array.isArray(wrangler?.d1_databases) && wrangler.d1_databases.length === 1, 'Wrangler must contain exactly one D1 binding')
  check(wrangler?.d1_databases?.[0]?.binding === 'DB', 'D1 binding must be DB')
  check(wrangler?.d1_databases?.[0]?.database_name === 'streamit', 'D1 database_name must be streamit')
  check(wrangler?.d1_databases?.[0]?.database_id === '3bc8aa15-6d59-42be-93df-23397c737c56', 'D1 database_id does not match the confirmed live database')
  check(Array.isArray(wrangler?.r2_buckets) && wrangler.r2_buckets.length === 1, 'Wrangler must contain exactly one R2 binding')
  check(wrangler?.r2_buckets?.[0]?.binding === 'MEDIA', 'R2 binding must be MEDIA')
  check(wrangler?.r2_buckets?.[0]?.bucket_name === 'halobox-migrated-media-20261105', 'R2 bucket_name does not match the confirmed live bucket')
  check(wrangler?.vars?.SESSION_SECRET === undefined, 'SESSION_SECRET must remain a secret and must not be committed as a plain variable')

  for (const file of snapshot.sourceFiles) {
    check(!file.includes('?tsr-split') && !file.includes('?tss-serverfn-split'), `Split-suffixed recovery artifact was copied: ${file}`)
  }
  check(typeof snapshot.files['src/styles.css'] === 'string' && snapshot.files['src/styles.css'].length > 0, 'src/styles.css must exist and be non-empty')
  return { failures, checks }
}

const snapshot = readSnapshot(projectRoot)
if (selfTest) {
  const badFixture = {
    files: { ...snapshot.files, 'src/routes/admin/teaching.tsx': null },
    sourceFiles: [...snapshot.sourceFiles, 'src/routes/admin/reviews.tsx', 'src/routes/admin/actors.tsx?tsr-split=component'],
  }
  badFixture.files['wrangler.jsonc'] = badFixture.files['wrangler.jsonc']?.replace('3bc8aa15-6d59-42be-93df-23397c737c56', 'known-bad-database-id')
  const result = evaluate(badFixture)
  const expectedFailures = [
    'Missing route artifact for /admin/teaching: src/routes/admin/teaching.tsx',
    'Obsolete route still exists: src/routes/admin/reviews.tsx',
    'D1 database_id does not match the confirmed live database',
    'Split-suffixed recovery artifact was copied: src/routes/admin/actors.tsx?tsr-split=component',
  ]
  const missed = expectedFailures.filter((message) => !result.failures.includes(message))
  if (missed.length > 0) {
    console.error('NEGATIVE_CONTROL_FAILED')
    for (const message of missed) console.error(`Checker did not detect: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`NEGATIVE_CONTROL_OK: detected all ${expectedFailures.length} known defects`)
  }
} else {
  const result = evaluate(snapshot)
  if (result.failures.length > 0) {
    console.error(`LIVE_BASELINE_FAILED: ${result.failures.length} of ${result.checks} assertions failed`)
    for (const failure of result.failures) console.error(`- ${failure}`)
    process.exitCode = 1
  } else {
    console.log(`Verified ${result.checks} baseline assertions across 38 live admin URLs.`)
    console.log('LIVE_BASELINE_OK')
  }
}
