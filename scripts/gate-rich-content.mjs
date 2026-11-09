import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(js, { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), URL, console }, { filename: file })
  return module.exports
}
const rich = load('src/lib/rich-text.ts')
const picker = load('src/lib/media-picker.ts')
const safe = '<h2>Welcome</h2><p>Hello <strong>reader</strong>.</p><ul><li>First</li><li>Second</li></ul><a href="https://halobox.tv/page/about">About</a>'
const hostile = safe + '<script>alert(1)</script><p onclick="bad()">Keep text</p><iframe src="https://evil.test"></iframe><svg onload="bad()"></svg><a href="jav&#x61;script:bad()">Bad</a><img src=x onerror=bad()><a href="//evil.test">Relative host</a><p style="background:url(javascript:bad())">Text</p>'
const cleaned = rich.sanitizeContentHtml(hostile)
assert.match(cleaned, /<h2>Welcome<\/h2>/)
assert.match(cleaned, /<strong>reader<\/strong>/)
assert.match(cleaned, /<ul><li>First<\/li><li>Second<\/li><\/ul>/)
assert.match(cleaned, /href="https:\/\/halobox.tv\/page\/about"/)
assert.match(cleaned, /rel="noopener noreferrer"/)
assert.doesNotMatch(cleaned, /script|iframe|svg|onload|onclick|onerror|<img|\/\/evil|style=/i)
assert.equal(rich.sanitizeContentHtml(cleaned), cleaned)
assert.equal(rich.richTextHasContent('<p><br></p>'), false)
assert.equal(rich.richTextHasContent('<p>&nbsp; </p>'), false)
assert.equal(rich.richTextHasContent('<p>Saved content</p>'), true)
assert.throws(() => rich.sanitizeContentHtml('x'.repeat(200001)), /200,000/)
assert.equal(picker.pickerKind('image/*'), 'image')
assert.equal(picker.pickerKind('.vtt,.srt'), 'subtitle')
assert.equal(picker.acceptsMedia({ key: 'uploads/poster.AVIF', kind: 'image' }, 'image/*'), true)
assert.equal(picker.acceptsMedia({ key: 'uploads/book.pdf', kind: 'document' }, 'image/*'), false)
assert.equal(picker.acceptsMedia({ key: 'uploads/en.vtt', kind: 'subtitle' }, '.vtt,.srt'), true)

// Real save handlers, authorization and SQLite writes: hostile HTML cannot bypass the editor by calling the RPC directly.
const sql = new DatabaseSync(':memory:')
sql.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,user_type TEXT,status INTEGER,is_banned INTEGER,deleted_at TEXT);
INSERT INTO users VALUES(1,'test@example.test','admin',1,0,NULL);
CREATE TABLE pages(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,description TEXT,status INTEGER,created_at TEXT,updated_at TEXT);
CREATE TABLE faqs(id INTEGER PRIMARY KEY,question TEXT,answer TEXT,status INTEGER,created_at TEXT,updated_at TEXT);
CREATE TABLE entertainments(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,type TEXT,description TEXT,created_by INTEGER,updated_by INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);
CREATE TABLE videos(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,description TEXT,created_by INTEGER,updated_by INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);`)
const database = {
  first: async (query, ...args) => sql.prepare(query).get(...args) ?? null,
  all: async (query, ...args) => sql.prepare(query).all(...args),
  run: async (query, ...args) => ({ meta: { last_row_id: Number(sql.prepare(query).run(...args).lastInsertRowid) } }),
}
const serverFn = () => { let validate = value => value; return { validator(fn) { validate = fn; return this }, handler(fn) { return input => fn({ data: validate(input?.data) }) } } }
let session = { uid: 1 }
const admin = load('src/lib/admin.ts', {
  '@tanstack/react-start': { createServerFn: serverFn, createServerOnlyFn: fn => fn },
  '@tanstack/react-start/server': { getRequest: () => ({ method: 'POST' }) },
  'cloudflare:workers': { env: {} }, './session.server': { getSession: async () => session }, './db': database,
  './rich-text': rich, './bunny': { normalizeBunnyFields: data => data }, './banner-design': {}, './channel-stream': {}, './live-sources': {},
  './locations-validation': { positiveId: value => value },
  './series-validation': { groupedType: () => null, assertGroupedRecord: async () => {}, validateGroupedValues: async () => {} },
})
await admin.adminUpsertRow({ data: { entity: 'pages', values: { name: 'About', slug: 'about', description: hostile, status: 1 } } })
await admin.adminUpsertRow({ data: { entity: 'faq', values: { question: 'How?', answer: hostile, status: 1 } } })
await admin.adminUpsertContent({ data: { name: 'Test sermon', type: 'movie', description: hostile } })
await admin.adminUpsertVideo({ data: { name: 'Test video', description: hostile } })
for (const [table, field] of [['pages', 'description'], ['faqs', 'answer'], ['entertainments', 'description'], ['videos', 'description']]) assert.equal(sql.prepare(`SELECT ${field} AS content FROM ${table}`).get().content, cleaned)
await admin.adminUpsertRow({ data: { entity: 'pages', id: 1, values: { description: '<h3>Updated</h3><ol><li>One</li></ol>' } } })
assert.equal(sql.prepare('SELECT description FROM pages WHERE id=1').get().description, '<h3>Updated</h3><ol><li>One</li></ol>')
assert.equal((await admin.adminGetRow({ data: { entity: 'pages', id: 1 } })).description, '<h3>Updated</h3><ol><li>One</li></ol>')
session = null
await assert.rejects(() => admin.adminUpsertRow({ data: { entity: 'pages', id: 1, values: { description: 'unauthorized' } } }), /Sign in required/)
session = { uid: 1 }; sql.exec("UPDATE users SET user_type='demo_admin'")
await assert.rejects(() => admin.adminUpsertVideo({ data: { name: 'No', description: 'No' } }), /read-only/)
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM videos').get().n, 1)
sql.close()
console.log('RICH_CONTENT_OK: semantic HTML and link safety, picker MIME filters, actual page/FAQ/content/video SQL saves, reopen persistence, anonymous/demo denial')
