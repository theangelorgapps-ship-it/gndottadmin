// Actual live-channel handlers and shipping migration against transactional SQLite.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), URL, console })
  return module.exports
}
const sql = new DatabaseSync(':memory:')
sql.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,user_type TEXT,status INTEGER,is_banned INTEGER,deleted_at TEXT);
INSERT INTO users VALUES(1,'admin@example.test','admin',1,0,NULL);
CREATE TABLE live_tv_category(id INTEGER PRIMARY KEY,name TEXT,status INTEGER,deleted_at TEXT);
INSERT INTO live_tv_category VALUES(1,'Live',1,NULL),(2,'Deleted',1,'2026-01-01');
CREATE TABLE live_tv_channel(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,category_id INTEGER,access TEXT,description TEXT,status INTEGER,poster_url TEXT,thumbnail_url TEXT,created_by INTEGER,updated_by INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);
INSERT INTO live_tv_channel(id,name,category_id,access,status) VALUES(35,'Kids',1,'free',1),(37,'Miracle TV',1,'free',1);
CREATE TABLE live_tv_stream_content_mapping(id INTEGER PRIMARY KEY,tv_channel_id INTEGER,stream_type TEXT,server_url TEXT,server_url1 TEXT,deleted_at TEXT);
INSERT INTO live_tv_stream_content_mapping VALUES(1,35,'HLS','https://cdn.example.test/kids.m3u8',NULL,NULL);
CREATE TABLE live_channel_settings(channel_id INTEGER PRIMARY KEY REFERENCES live_tv_channel(id),source_kind TEXT NOT NULL DEFAULT 'hls' CHECK(source_kind IN ('hls','rtmp')),hls_url TEXT,ingest_url TEXT,comments_enabled INTEGER NOT NULL DEFAULT 1 CHECK(comments_enabled IN (0,1)),slow_mode INTEGER NOT NULL DEFAULT 5 CHECK(slow_mode BETWEEN 0 AND 120),updated_by INTEGER,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO live_channel_settings VALUES(37,'rtmp','https://cdn.example.test/live.m3u8','rtmps://ingest.example.test/private-key',0,12,1,'2026-01-01');`)
const before = sql.prepare('SELECT * FROM live_channel_settings').get()
sql.exec('BEGIN IMMEDIATE')
sql.exec(readFileSync('migrations/20261109_live_embed.sql', 'utf8'))
sql.exec('COMMIT')
const { embed_url, ...preserved } = sql.prepare('SELECT * FROM live_channel_settings').get()
assert.deepEqual(preserved, { ...before })
assert.equal(embed_url, null)
assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length, 0)
let failSettings = false
const database = {
  first: async (q, ...args) => sql.prepare(q).get(...args) ?? null,
  all: async (q, ...args) => sql.prepare(q).all(...args),
  run: async (q, ...args) => sql.prepare(q).run(...args),
}
const d1 = {
  prepare: query => ({ bind: (...args) => ({ query, args }) }),
  batch: async statements => {
    sql.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map(({ query, args }) => {
        if (failSettings && query.includes('INSERT INTO live_channel_settings')) throw new Error('Simulated database failure')
        if (query.includes('RETURNING')) return { results: sql.prepare(query).all(...args) }
        return { meta: sql.prepare(query).run(...args) }
      })
      sql.exec('COMMIT'); return results
    } catch (error) { sql.exec('ROLLBACK'); throw error }
  },
}
const factory = () => { let validate = x => x; return { validator(fn) { validate = fn; return this }, handler(fn) { return async input => fn({ data: validate(input?.data) }) } } }
let session = { uid: 1 }, method = 'POST'
const sources = load('src/lib/live-sources.ts')
const api = load('src/lib/admin.ts', {
  '@tanstack/react-start': { createServerFn: factory, createServerOnlyFn: fn => fn },
  '@tanstack/react-start/server': { getRequest: () => ({ method }) },
  'cloudflare:workers': { env: { DB: d1 } }, './session.server': { getSession: async () => session }, './db': database,
  './rich-text': load('src/lib/rich-text.ts'), './bunny': {}, './banner-design': load('src/lib/banner-design.ts'),
  './live-sources': sources, './locations-validation': load('src/lib/locations-validation.ts'), './series-validation': {},
})
const draft = { name: 'New channel', access: 'free', description: '<p>Hello <strong>viewer</strong><script>bad()</script></p>', status: 1, category_id: 1, poster_url: '/media/poster.avif', thumbnail_url: '/media/wide.avif', source_kind: 'hls', hls_url: 'https://cdn.example.test/output.m3u8', ingest_url: '', embed_url: '', comments_enabled: true, slow_mode: 5 }
const save = data => api.adminUpsertChannel({ data })
session = null
await assert.rejects(save(draft), /Sign in required/)
session = { uid: 1 }; sql.exec("UPDATE users SET user_type='demo_admin'")
await assert.rejects(save(draft), /read-only/)
sql.exec("UPDATE users SET user_type='admin'")
for (const change of [{ hls_url: 'rtmp://ingest.test/key' }, { hls_url: 'https://127.0.0.1/' }, { source_kind: 'embed', embed_url: 'https://evil.test/embed' }, { source_kind: 'embed', embed_url: '<iframe src="https://iframe.viewmedia.tv?channel=030"></iframe>' }, { source_kind: 'rtmp', ingest_url: '' }, { category_id: 2 }, { id: 999 }, { slow_mode: -1 }]) await assert.rejects(save({ ...draft, ...change }))
const created = await save(draft)
assert.ok(created.id > 37)
assert.equal(sql.prepare('SELECT hls_url FROM live_channel_settings WHERE channel_id=?').get(created.id).hls_url, draft.hls_url)
assert.equal(sql.prepare('SELECT description FROM live_tv_channel WHERE id=?').get(created.id).description, '<p>Hello <strong>viewer</strong></p>')
const updated = { ...draft, id: 37, name: 'Miracle TV', source_kind: 'embed', embed_url: 'https://iframe.viewmedia.tv?channel=030', hls_url: 'unfinished', ingest_url: 'unfinished', comments_enabled: false, slow_mode: 12 }
await save(updated)
const settings = sql.prepare('SELECT * FROM live_channel_settings WHERE channel_id=37').get()
assert.equal(settings.embed_url, 'https://iframe.viewmedia.tv/?channel=030')
assert.equal(settings.hls_url, null); assert.equal(settings.ingest_url, null)
assert.equal(settings.comments_enabled, 0); assert.equal(settings.slow_mode, 12)
const listed = await api.adminListChannels()
assert.equal(listed.channels.find(c => c.id === 35).hls_url, 'https://cdn.example.test/kids.m3u8')
assert.equal(listed.channels.find(c => c.id === 37).source_kind, 'embed')
assert.equal(listed.channels.find(c => c.id === 37).thumbnail_url, draft.thumbnail_url)
assert.equal(listed.categories.length, 1)
const previousCount = sql.prepare('SELECT COUNT(*) AS n FROM live_tv_channel').get().n
failSettings = true
await assert.rejects(save(draft), /database failure/)
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM live_tv_channel').get().n, previousCount, 'Channel insert rolls back when settings fail')
await assert.rejects(save({ ...updated, name: 'Must roll back' }), /database failure/)
assert.equal(sql.prepare('SELECT name FROM live_tv_channel WHERE id=37').get().name, 'Miracle TV')
assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length, 0)
sql.close()
console.log('LIVE_CHANNEL_OK: migration preservation, auth/demo denial, source validation, current artwork, legacy HLS, embedded settings, and atomic create/update rollback')
