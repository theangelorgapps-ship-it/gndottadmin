import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const read = path => readFileSync(resolve(root, path), 'utf8')
function load(path, mocks = {}, globals = {}) {
  const exports = {}
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(output, { exports, require: name => {
    if (name in mocks) return mocks[name]
    if (name === 'react' || name === 'react/jsx-runtime') return require(name)
    if (name.endsWith('img-manifest.json')) return JSON.parse(read('src/lib/img-manifest.json'))
    return {}
  }, console, URL, Request, Response, Headers, FormData, File, Blob, TransformStream, TextEncoder, TextDecoder, setTimeout, clearTimeout, ...globals }, { filename: path })
  return exports
}

// The server-rendered form cannot leak named credentials into a GET URL while
// JavaScript is downloading. No auth handler or email transport is called.
const loginRoute = load('src/routes/login.tsx', {
  '@tanstack/react-router': { createFileRoute: () => config => config },
  'lucide-react': { Eye: () => null, EyeOff: () => null },
  '../components/AdminBrand': { AdminBrand: () => null },
  '../components/SocialSignIn': { SocialSignIn: () => null },
}).Route
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const loginMarkup = renderToStaticMarkup(React.createElement(loginRoute.component))
assert.match(loginMarkup, /<form[^>]*method="post"/)
for (const field of ['email', 'password']) {
  const input = loginMarkup.match(new RegExp(`<input[^>]*name="${field}"[^>]*>`))?.[0]
  assert.ok(input && /disabled=""/.test(input), `${field} stays disabled until hydration`)
}
assert.match(loginMarkup, /<button[^>]*type="submit"[^>]*disabled=""/)
assert.ok(!loginMarkup.includes('method="get"'))

// Exercise the actual image resolver against public, private, migrated, and unknown sources.
const { img, DEFAULT_IMG } = load('src/components/Poster.tsx')
assert.equal(img('/media/uploads/new.avif'), 'https://halobox.tv/media/uploads/new.avif')
assert.equal(img('media/uploads/new.avif'), 'https://halobox.tv/media/uploads/new.avif')
assert.equal(img('/api/account-media/private/avatar.avif'), '/api/account-media/private/avatar.avif')
assert.equal(img('https://cdn.example.org/actual-poster.avif?token=abc'), 'https://cdn.example.org/actual-poster.avif?token=abc')
assert.equal(img('/images/video/victory_vibes.webp'), 'https://halobox.tv/images/video/victory_vibes.avif')
assert.equal(img('http://localhost:8000/storage/victory_vibes.webp'), 'https://halobox.tv/images/video/victory_vibes.avif')
assert.equal(img('javascript:alert(1)'), DEFAULT_IMG)
assert.equal(img('unknown-file.avif'), DEFAULT_IMG)
assert.equal(img(null), DEFAULT_IMG)

// Priority ordering is deterministic, handles punctuation, and never mutates loader data.
const { orderPersonalities } = load('src/components/CrudTable.tsx')
const people = [{ id: 9, name: 'Zara' }, { id: 2, name: 'Neviah' }, { id: 5, name: "Ra’ah" }, { id: 3, name: 'Abel' }]
assert.deepEqual(Array.from(orderPersonalities(people), value => value.id), [5, 2, 3, 9])
assert.deepEqual(people.map(value => value.id), [9, 2, 5, 3])
assert.deepEqual(Array.from(orderPersonalities([{ name: 'BeBe Angel' }, { name: 'Uebert Angel' }]), value => value.name), ['Uebert Angel', 'BeBe Angel'])

// Render route components with real field declarations and test parent/group transitions.
const { fieldOptions, changeField } = load('src/lib/crud-fields.ts')
const options = {
  shows: [{ id: 1, name: 'Show A' }, { id: 2, name: 'Show B' }],
  teaching: [{ id: 3, name: 'Teaching A' }],
  seasons: [
    { id: 11, name: 'Series A', entertainment_id: 1, type: 'tvshow' },
    { id: 12, name: 'Series B', entertainment_id: 2, type: 'tvshow' },
    { id: 31, name: 'Volume A', entertainment_id: 3, type: 'teaching' },
  ],
}
for (const [path, parent, group, expectedParents] of [
  ['episodes', 1, 11, [1, 2]], ['teaching-episodes', 3, 31, [3]],
]) {
  const route = load(`src/routes/admin/${path}.tsx`, {
    '@tanstack/react-router': { createFileRoute: () => config => ({ ...config, useLoaderData: () => ({ rows: [], options }) }) },
    '../../components/CrudTable': { CrudTable: () => null },
  }).Route
  const { fields, columns } = route.component().props
  const parentField = fields.find(field => field.key === 'entertainment_id')
  const groupField = fields.find(field => field.key === 'season_id')
  assert.deepEqual(Array.from(parentField.options, value => value.value), expectedParents)
  assert.equal(groupField.dependsOn, 'entertainment_id')
  assert.deepEqual(Array.from(fieldOptions(groupField, { entertainment_id: parent }), value => value.value), [group])
  assert.equal(changeField(fields, { entertainment_id: parent, season_id: group }, 'entertainment_id', 999).season_id, '')
  assert.deepEqual(Array.from(fields.find(field => field.key === 'access').options, value => value.value), ['free', 'paid'])
  assert.equal(columns[0].kind, 'img')
}

// Integration invariants: retain canonical auth calls and shared upload/mapping paths.
const login = read('src/routes/login.tsx')
for (const call of ['await login(', 'await requestOtp(', 'await verifyOtp(', 'authClient.emailOtp.resetPassword(', 'authClient.emailOtp.requestPasswordReset(', '<SocialSignIn callbackURL="/admin"']) assert.ok(login.includes(call), `Missing auth flow: ${call}`)
assert.ok(!/Dali|GitHub|>GH</.test(login))
const brand = read('src/components/AdminBrand.tsx')
assert.ok(brand.includes('https://halobox.tv/goodnews-halo-logo.avif'))
assert.ok(read('src/components/AdminProfileMenu.tsx').includes('await logout()'))
assert.ok(read('src/routes/admin.tsx').includes('state.isLoading'))
assert.ok(read('src/routes/admin.tsx').includes("label: 'Categories'"))
for (const path of ['src/components/CrudTable.tsx', 'src/components/admin-content.tsx', 'src/routes/admin/genres.tsx', 'src/routes/admin/settings.tsx']) {
  const source = read(path)
  assert.ok(source.includes('<UploadDialog'), `${path} must use the shared popup`)
  assert.ok(!source.includes('type="file"'), `${path} must not bypass the shared popup`)
}
assert.ok(read('src/routes/admin/videos.tsx').includes('table="videos"'))
assert.ok(read('src/routes/admin/videos.tsx').includes('<UploadButton'))
const content = read('src/components/admin-content.tsx')
assert.ok(content.includes('editing.location_ids'))
assert.ok(content.includes('(options?.locations ?? []).map'))
assert.ok(!content.includes('directors.map'))
assert.ok(read('src/routes/admin/genres.tsx').includes('file_url: genre.file_url'))
assert.ok(read('src/components/AdminDataTable.tsx').includes('aria-label={`Edit ${rowName}`}'))
// Public delivery preserves safe metadata, forces PDF downloads, and keeps active documents sandboxed.
const authCore = load('src/lib/authCore.ts')
const accountMedia = load('src/lib/account-media.server.ts')
let mediaReads = 0
const media = load('src/routes/media/$.ts', {
  '@tanstack/react-router': { createFileRoute: () => config => config },
  'cloudflare:workers': { env: { MEDIA: { get: async () => { mediaReads++; return { body: 'image', httpMetadata: { contentType: 'image/avif' } } } } } },
  '../../lib/account-media.server': accountMedia,
})
let headers = media.publicMediaHeaders('uploads/poster.avif', { contentType: 'image/avif', contentDisposition: 'inline; filename="poster.avif"' })
assert.equal(headers.get('content-disposition'), 'inline; filename="poster.avif"')
assert.equal(headers.get('content-security-policy'), null)
headers = media.publicMediaHeaders('uploads/book.pdf', { contentType: 'application/pdf', contentDisposition: 'inline; filename="book.pdf"' })
assert.equal(headers.get('content-disposition'), 'attachment; filename="book.pdf"')
assert.equal(headers.get('content-security-policy'), "default-src 'none'; sandbox")
for (const type of ['text/html', 'image/svg+xml', 'application/octet-stream']) {
  headers = media.publicMediaHeaders('uploads/unsafe', { contentType: type, contentDisposition: 'inline' })
  assert.match(headers.get('content-disposition'), /^attachment/)
  assert.match(headers.get('content-security-policy'), /sandbox/)
}
headers = media.publicMediaHeaders('uploads/book.pdf', { contentType: 'application/pdf', contentDisposition: 'inline; filename="bad\r\nx-header: injected"' })
assert.equal(headers.get('content-disposition'), 'attachment; filename="book.pdf"')
headers = media.publicMediaHeaders('uploads/book.pdf', { contentType: 'application/pdf', contentDisposition: 'inline; filename="日本語.pdf"' })
assert.equal(headers.get('content-disposition'), 'attachment; filename="book.pdf"')
for (const key of ['private/secret.avif', 'PRIVATE/secret.avif', '../secret', 'uploads/a%2fb', 'uploads/a\n']) {
  const response = await media.Route.server.handlers.GET({ params: { _splat: key } })
  assert.equal(response.status, 404)
}
assert.equal(mediaReads, 0, 'Rejected paths must not reach bucket storage')
assert.equal((await media.Route.server.handlers.GET({ params: { _splat: 'uploads/poster.avif' } })).status, 200)

// Request-level Bunny checks run offline with mocked storage and provider calls.
let currentUser = { user_type: 'admin', status: 1, is_banned: 0, deleted_at: null }
let sessionReads = 0, providerCalls = 0, databaseWrites = 0, rowExists = true, signedIn = true
const guid = '12345678-1234-1234-1234-123456789abc'
const bunny = load('src/routes/api/bunny-upload.ts', {
  '@tanstack/react-router': { createFileRoute: () => config => config },
  '../../lib/authCore': authCore,
  '../../lib/session.server': { getSession: async () => { sessionReads++; return signedIn ? { uid: 7 } : null } },
  '../../lib/db': {
    first: async sql => sql.includes('FROM users') ? currentUser
      : sql.includes('bunny_library_id') ? { val: '123' }
      : sql.includes('bunny_api_key') ? { val: 'test-only-key' }
      : rowExists ? { id: 9 } : null,
    run: async () => { databaseWrites++; return { success: true, meta: { changes: 1 } } },
  },
}, { fetch: async (_url, options) => { providerCalls++; return options.method === 'POST' ? Response.json({ guid }) : new Response(null, { status: 200 }) } })
const video = () => new File([new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,0,0,0,0])], 'message.mp4', { type: 'video/mp4' })
function uploadRequest({ origin = 'https://fort.halobox.tv', site = 'same-origin', file = video(), table = 'videos', rowId = '9', title = 'A message' } = {}) {
  const form = new FormData(); form.append('file', file); form.append('title', title); form.append('table', table)
  if (rowId !== null) form.append('row_id', rowId)
  const headers = { 'sec-fetch-site': site }; if (origin !== null) headers.origin = origin
  return new Request('https://fort.halobox.tv/api/bunny-upload', { method: 'POST', headers, body: form })
}
for (const input of [{ origin: 'https://attacker.invalid' }, { origin: null }, { site: 'cross-site' }]) assert.equal((await bunny.handleBunnyUpload(uploadRequest(input))).status, 403)
assert.equal(sessionReads, 0, 'CSRF must fail before session and body handling')
for (const overrides of [{ user_type: 'demo_admin' }, { status: 0 }, { is_banned: 1 }, { deleted_at: '2026-11-08' }]) {
  currentUser = { user_type: 'admin', status: 1, is_banned: 0, deleted_at: null, ...overrides }
  const request = uploadRequest(); let bodyRead = false
  Object.defineProperty(request, 'body', { get() { bodyRead = true; throw new Error('Body must not be read') } })
  assert.equal((await bunny.handleBunnyUpload(request)).status, 403)
  assert.equal(bodyRead, false)
}
currentUser = { user_type: 'admin', status: 1, is_banned: 0, deleted_at: null }
signedIn = false
assert.equal((await bunny.handleBunnyUpload(uploadRequest())).status, 403)
signedIn = true
const oversized = uploadRequest(); oversized.headers.set('content-length', String(501 * 1024 * 1024))
assert.equal((await bunny.handleBunnyUpload(oversized)).status, 413)
const duplicateFiles = new FormData(); duplicateFiles.append('file', video()); duplicateFiles.append('file', video())
await assert.rejects(() => bunny.validateBunnyForm(duplicateFiles), /Choose one video file/)
for (const [input, status] of [
  [{ file: 'not-a-file' }, 400],
  [{ file: new File(['not a video'], 'fake.mp4', { type: 'video/mp4' }) }, 415],
  [{ table: 'users; DROP TABLE users' }, 400],
  [{ rowId: '-1' }, 400],
  [{ rowId: '9.5' }, 400],
  [{ rowId: '9007199254740992' }, 400],
  [{ title: 'x'.repeat(251) }, 400],
]) assert.equal((await bunny.handleBunnyUpload(uploadRequest(input))).status, status)
rowExists = false
assert.equal((await bunny.handleBunnyUpload(uploadRequest())).status, 404)
rowExists = true
assert.equal(providerCalls, 0, 'All validation must precede provider writes')
assert.equal(databaseWrites, 0)
const response = await bunny.handleBunnyUpload(uploadRequest())
assert.equal(response.status, 200)
assert.equal((await response.json()).videoId, guid)
assert.equal(providerCalls, 2)
assert.equal(databaseWrites, 1)
const unsaved = await bunny.handleBunnyUpload(uploadRequest({ rowId: null, title: '' }))
assert.equal(unsaved.status, 200)
assert.equal((await unsaved.json()).attached, false)
assert.equal(databaseWrites, 1, 'Unsaved editors must not write an arbitrary row')
assert.ok(read('src/routes/admin/locations.tsx').includes('<UploadDialog'))
assert.ok(!read('src/routes/admin/locations.tsx').includes('type="file"'))
assert.ok(read('src/routes/admin/index.tsx').includes('Top 5 Categories'))
console.log('ADMIN_POLISH_OK')
