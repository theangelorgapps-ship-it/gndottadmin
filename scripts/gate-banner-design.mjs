#!/usr/bin/env node
// Actual admin handlers + actual public loader on isolated SQLite; no network or production data.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const websiteRoot = process.env.HALOBOX_WEBSITE_ROOT ?? '/Users/charlesfinney/Documents/Codex/Projects/New project/gndott'
const { HERO_SQL_SCHEMA, createHeroHarness, runHeroRenderingGate, serial } = await import(pathToFileURL(resolve(websiteRoot, 'scripts/gate-hero-design.mjs')).href)
const database = new DatabaseSync(':memory:')
let session = { uid: 1 }, requestMethod = 'GET'
const statements = []
const d1 = {
  prepare(query) {
    const statement = values => ({
      query, values,
      bind: (...next) => statement(next),
      async all() { statements.push(query); return { results: database.prepare(query).all(...values) } },
      async first() { statements.push(query); return database.prepare(query).get(...values) ?? null },
      async run() {
        statements.push(query)
        const result = database.prepare(query).run(...values)
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }
      },
    })
    return statement([])
  },
  async batch(batch) {
    database.exec('BEGIN IMMEDIATE')
    try {
      const results = []
      for (const statement of batch) results.push(await statement.run())
      database.exec('COMMIT')
      return results
    } catch (error) { database.exec('ROLLBACK'); throw error }
  },
}
function createServerFn({ method }) {
  let validate = value => value
  return {
    validator(fn) { validate = fn; return this },
    handler(handler) {
      return async input => {
        const before = requestMethod; requestMethod = method
        try { return await handler({ data: validate(input?.data) }) } finally { requestMethod = before }
      }
    },
  }
}
const cache = new Map()
function load(relative) {
  const path = resolve(root, relative)
  if (cache.has(path)) return cache.get(path)
  const module = { exports: {} }; cache.set(path, module.exports)
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const localRequire = id => {
    if (id === 'cloudflare:workers') return { env: { DB: d1 } }
    if (id === '@tanstack/react-start') return { createServerFn, createServerOnlyFn: fn => fn }
    if (id === '@tanstack/react-start/server') return { getRequest: () => new Request('https://fort.example.test/admin', { method: requestMethod }) }
    if (id.endsWith('/session.server')) return { getSession: async () => session }
    if (id.startsWith('.')) {
      const base = resolve(dirname(path), id)
      const dependency = [base, `${base}.ts`].find(candidate => existsSync(candidate))
      if (!dependency) throw new Error(`Unknown test dependency ${id}`)
      return load(dependency)
    }
    throw new Error(`Unexpected dependency ${id}`)
  }
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, Request, Response, URL, console }, { filename: path })
  return module.exports
}
const frame = (image, x = 50, y = 50, fit = 'cover', align = 'center') => ({ image, x, y, fit, align })
const design = { version: 1, devices: {
  phone: frame('/media/phone.avif', 10, 20, 'contain', 'left'),
  tablet: frame('/media/tablet.avif', 30, 40, 'cover', 'right'),
  web: frame('https://images.example.test/web.avif', 50, 60),
  app: frame('/media/app.avif', 70, 80),
} }
const baseInput = { title: 'Featured sermon', type: 'movie', type_id: 1, banner_for: 'home', status: 1, file_url: '/media/default-web.avif', poster_url: '/media/default-phone.avif', design }
const bannerSnapshot = () => JSON.stringify({
  banners: database.prepare('SELECT * FROM banners ORDER BY id').all(),
  designs: database.prepare('SELECT * FROM banner_designs ORDER BY banner_id').all(),
  sequence: database.prepare("SELECT * FROM sqlite_sequence WHERE name='banners'").all(),
})

try {
  database.exec(HERO_SQL_SCHEMA)
  database.exec(readFileSync(resolve(root, 'migrations/20261108_banner_design.sql'), 'utf8'))
  database.exec(`
    CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,user_type TEXT,status INTEGER,is_banned INTEGER,deleted_at TEXT);
    INSERT INTO users VALUES (1,'admin@example.test','admin',1,0,NULL),(2,'viewer@example.test','user',1,0,NULL),(3,'demo@example.test','demo_admin',1,0,NULL),(4,'inactive@example.test','admin',0,0,NULL),(5,'banned@example.test','admin',1,1,NULL),(6,'deleted@example.test','admin',1,0,'2026-01-01');
    CREATE TABLE genres(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,slug TEXT,status INTEGER,file_url TEXT,deleted_at TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE entertainment_gener_mapping(entertainment_id INTEGER,genre_id INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    CREATE TABLE cast_crew(id INTEGER PRIMARY KEY,name TEXT,type TEXT,deleted_at TEXT);
    CREATE TABLE entertainment_talent_mapping(entertainment_id INTEGER,talent_id INTEGER,type TEXT,deleted_at TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE locations(id INTEGER PRIMARY KEY,name TEXT,source_cast_crew_id INTEGER,deleted_at TEXT);
    CREATE TABLE content_location_mapping(location_id INTEGER,content_type TEXT,content_id INTEGER,PRIMARY KEY(location_id,content_type,content_id));
    CREATE TABLE entertainment_views(entertainment_id INTEGER);
    CREATE TABLE plan(id INTEGER PRIMARY KEY,name TEXT,level INTEGER,deleted_at TEXT);
  `)
  const titleInsert = database.prepare('INSERT INTO entertainments(id,name,type,slug,poster_url,thumbnail_url,movie_access,status,deleted_at,is_restricted,video_url_input,bunny_video_url,trailer_url,bunny_trailer_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const [id, name, type, access, status, deleted, child] of [
    [1,'Public sermon','movie','free',1,null,0], [2,'Paid sermon','movie','paid',1,null,0],
    [3,'Teaching','teaching','free',1,null,0], [4,'Show','tvshow','free',1,null,0],
    [5,'Hidden sermon','movie','free',0,null,0], [6,'Soon-deleted sermon','movie','free',1,null,0],
    [7,'Restricted sermon','movie','free',1,null,1], [8,'Unknown access','movie',null,1,null,0],
  ]) titleInsert.run(id,name,type,`title-${id}`,`/media/title-${id}.avif`,`/media/title-${id}-wide.avif`,access,status,deleted,child,`https://media.example.test/${access ?? 'unknown'}-${id}.mp4`,`secret-bunny-title-${id}`,`https://trailers.example.test/${id}.mp4`,`public-trailer-${id}`)
  const videoInsert = database.prepare('INSERT INTO videos(id,name,poster_url,thumbnail_url,access,status,is_restricted,video_url_input,bunny_video_url) VALUES(?,?,?,?,?,?,?,?,?)')
  for (const [id,name,access,status,child] of [[1,'Distinct video with same ID','free',1,0],[2,'Paid video','paid',1,0],[3,'Hidden video','free',0,0],[4,'Soon-deleted video','free',1,0],[5,'Restricted video','free',1,1]]) videoInsert.run(id,name,`/media/video-${id}.avif`,`/media/video-${id}-wide.avif`,access,status,child,`https://media.example.test/video-${id}.mp4`,`secret-bunny-video-${id}`)

  const admin = load('src/lib/admin.ts')
  const website = createHeroHarness(database)
  const create = patch => admin.adminSaveHeroBanner({ data: { ...baseInput, ...patch } })
  const created = await create({ title: '  Featured sermon  ' })
  assert.equal(created.ok, true)
  assert.ok(Number.isSafeInteger(created.id) && created.id > 0)
  let published = await website.loadConfiguredHeroes('home')
  assert.equal(published.length, 1)
  assert.equal(published[0].banner_id, created.id)
  assert.equal(published[0].name, 'Public sermon')
  assert.equal(published[0].poster_url, baseInput.poster_url)
  assert.equal(published[0].thumbnail_url, baseInput.file_url)
  assert.deepEqual(serial(published[0].hero_design), design)
  assert.equal(database.prepare('SELECT title FROM banners WHERE id=?').get(created.id).title, 'Featured sermon')

  const updatedDesign = { version: 1, devices: { web: frame('/media/new-web.avif', 0, 100, 'contain', 'right'), phone: frame('/media/new-phone.avif', 100, 0, 'cover', 'left') } }
  await create({ id: created.id, title: 'Updated teaching', type: 'teaching', type_id: 3, banner_for: 'teaching', file_url: '', poster_url: '', design: updatedDesign })
  assert.equal((await website.loadConfiguredHeroes('home')).length, 0)
  published = await website.loadConfiguredHeroes('teaching')
  assert.equal(published.length, 1)
  assert.equal(published[0].name, 'Teaching')
  assert.equal(published[0].poster_url, '/media/title-3.avif')
  assert.deepEqual(serial(published[0].hero_design), updatedDesign, 'Update replaces removed device frames instead of retaining stale ones')
  assert.equal(database.prepare('SELECT COUNT(*) n FROM banners').get().n, 1)

  // Fail the second actual SQL statement: banner row and AUTOINCREMENT sequence must roll back together.
  database.exec(`CREATE TRIGGER reject_hero_design BEFORE INSERT ON banner_designs
    WHEN json_extract(NEW.design_json,'$.devices.web.image')='/media/force-rollback.avif'
    BEGIN SELECT RAISE(ABORT,'forced design failure'); END;`)
  const beforeRollback = bannerSnapshot()
  const badDesign = { version: 1, devices: { web: frame('/media/force-rollback.avif') } }
  await assert.rejects(() => create({ design: badDesign }), /forced design failure/)
  assert.equal(bannerSnapshot(), beforeRollback, 'Failed create must roll back both tables and sqlite_sequence')
  await assert.rejects(() => create({ id: created.id, title: 'Must not persist', design: badDesign }), /forced design failure/)
  assert.equal(bannerSnapshot(), beforeRollback, 'Failed update must leave banner and prior design untouched')
  database.exec('DROP TRIGGER reject_hero_design')

  const free = await create({})
  const paid = await create({ title: 'Paid', type_id: 2 })
  const video = await create({ title: 'Video', type: 'video', type_id: 1 })
  const paidVideo = await create({ title: 'Paid video', type: 'video', type_id: 2 })
  await create({ title: 'Hidden target', type_id: 5 })
  await create({ title: 'Deleted target', type_id: 6 })
  const restricted = await create({ title: 'Restricted', type_id: 7 })
  const unknownAccess = await create({ title: 'Unknown access', type_id: 8 })
  await create({ title: 'Hidden banner', status: 0 })
  const deletedBanner = await create({ title: 'Deleted banner' })
  await create({ title: 'Hidden video', type: 'video', type_id: 3 })
  await create({ title: 'Deleted video', type: 'video', type_id: 4 })
  const restrictedVideo = await create({ title: 'Restricted video', type: 'video', type_id: 5 })
  database.exec(`UPDATE entertainments SET deleted_at='2026-01-01' WHERE id=6; UPDATE videos SET deleted_at='2026-01-01' WHERE id=4;`)
  database.prepare("UPDATE banners SET deleted_at='2026-01-01' WHERE id=?").run(deletedBanner.id)
  database.exec(`INSERT INTO banners(title,type,type_id,banner_for,status) VALUES('No design','movie',1,'home',1);
    INSERT INTO banners(title,type,type_id,banner_for,status) VALUES('Wrong source type','movie',4,'home',1);
    INSERT INTO banner_designs(banner_id,design_json) SELECT seq,'{"version":1,"devices":{}}' FROM sqlite_sequence WHERE name='banners';`)
  published = await website.loadConfiguredHeroes('home')
  const expected = [free.id,paid.id,video.id,paidVideo.id,restricted.id,unknownAccess.id,restrictedVideo.id]
  assert.deepEqual(Array.from(published, row => row.banner_id), expected)
  assert.equal(published.find(row => row.banner_id === video.id).name, 'Distinct video with same ID', 'Video ID collisions must not resolve to entertainments')
  assert.equal(published.find(row => row.banner_id === free.id).video_url_input, 'https://media.example.test/free-1.mp4')
  for (const id of [paid.id, paidVideo.id, unknownAccess.id]) {
    const row = published.find(row => row.banner_id === id)
    assert.equal(row.video_url_input, null)
    assert.ok(!('bunny_video_url' in row))
    assert.ok(!JSON.stringify(row).includes('secret-bunny'))
  }
  assert.deepEqual(Array.from(await website.loadConfiguredHeroes('home', true), row => row.banner_id), expected.filter(id => ![restricted.id,restrictedVideo.id].includes(id)))
  await assert.rejects(() => website.loadConfiguredHeroes('invalid'), /placement/)
  for (const placement of ['movie','tv_show','video']) {
    const item = await create({ banner_for: placement })
    assert.deepEqual(Array.from(await website.loadConfiguredHeroes(placement), row => row.banner_id), [item.id])
  }

  // Every invalid request must leave both tables and the next-ID sequence unchanged.
  const invalid = [
    { title: '' }, { title: 'x'.repeat(201) }, { title: null }, { type: 'unknown' }, { banner_for: 'unknown' },
    { type_id: 0 }, { type_id: -1 }, { type_id: 1.5 }, { type_id: '1' }, { type_id: 999 }, { type_id: 6 },
    { type: 'teaching', type_id: 1 }, { status: -1 }, { status: 2 }, { status: '1' },
    { id: 0 }, { id: -1 }, { id: '1' }, { id: 999 }, { id: deletedBanner.id },
    ...['javascript:alert(1)','http://example.test/image.jpg','//example.test/image.jpg','/media/../private','https://u:p@example.test/image.jpg'].flatMap(url => [{ file_url: url }, { poster_url: url }, { design: { version: 1, devices: { web: frame(url) } } }]),
    { design: null }, { design: [] }, { design: { version: 2, devices: {} } }, { design: { version: 1, devices: [] } },
    { design: { version: 1, devices: { unknown: frame('') } } },
    ...[{ x: -1 },{ y: 101 },{ x: Infinity },{ fit: 'stretch' },{ align: 'justify' }].map(patch => ({ design: { version: 1, devices: { web: { ...frame(''), ...patch } } } })),
  ]
  for (const patch of invalid) {
    const before = bannerSnapshot()
    await assert.rejects(() => create(patch), undefined, `Invalid request accepted: ${JSON.stringify(patch)}`)
    assert.equal(bannerSnapshot(), before)
  }
  for (const uid of [null,2,3,4,5,6,999]) {
    session = uid === null ? null : { uid }
    const before = bannerSnapshot()
    await assert.rejects(() => create({}), /Sign in required|Admin access required|read-only/)
    assert.equal(bannerSnapshot(), before)
  }
  session = { uid: 3 }
  assert.ok((await admin.adminHeroBanners()).length > 0, 'Demo role retains read-only access')
  session = { uid: 1 }

  // Categories use the migrated file_url column end-to-end (confirmed by live PRAGMA).
  const category = await admin.adminUpsertGenre({ data: { name: 'Test category', status: 1, file_url: '/media/category.avif' } })
  assert.equal(database.prepare('SELECT file_url FROM genres WHERE id=?').get(category.id).file_url, '/media/category.avif')
  assert.equal((await admin.adminListGenres()).find(row => row.id === category.id).file_url, '/media/category.avif')
  await admin.adminUpsertGenre({ data: { id: category.id, name: 'Renamed category', status: 1 } })
  assert.equal(database.prepare('SELECT file_url FROM genres WHERE id=?').get(category.id).file_url, '/media/category.avif')
  await admin.adminUpsertGenre({ data: { id: category.id, name: 'Renamed category', status: 1, file_url: '' } })
  assert.equal(database.prepare('SELECT file_url FROM genres WHERE id=?').get(category.id).file_url, '')
  await assert.rejects(() => admin.adminUpsertGenre({ data: { id: category.id, name: 'Invalid', file_url: 'javascript:alert(1)' } }))
  const listVideo = (await admin.adminListVideos()).find(row => row.id === 1)
  assert.equal(listVideo.poster_url, '/media/video-1.avif')
  assert.equal(listVideo.thumbnail_url, '/media/video-1-wide.avif')
  const listTitle = (await admin.adminListContent({ data: 'movie' })).find(row => row.id === 1)
  assert.equal(listTitle.poster_url, '/media/title-1.avif', 'Title lists must supply the poster field rendered by the table')
  assert.equal(listTitle.thumbnail_url, '/media/title-1-wide.avif')

  database.exec(`INSERT INTO locations VALUES(10,'Visible location',NULL,NULL),(20,'Deleted location',NULL,'2026-01-01');
    INSERT INTO content_location_mapping VALUES(10,'entertainment',1),(20,'entertainment',1);`)
  const loaded = await admin.adminGetContent({ data: 1 })
  assert.deepEqual(Array.from(loaded.location_ids), [10], 'Deleted locations must not create invisible invalid selections')
  await admin.adminUpsertContent({ data: { id: 1, name: 'Updated safely', type: 'movie', location_ids: loaded.location_ids } })
  assert.deepEqual(database.prepare("SELECT location_id FROM content_location_mapping WHERE content_type='entertainment' AND content_id=1 ORDER BY location_id").all().map(row => row.location_id), [10,20], 'Editing visible locations preserves archived associations')
  await admin.adminUpsertContent({ data: { id: 1, name: 'No visible locations', type: 'movie', location_ids: [] } })
  assert.deepEqual(database.prepare("SELECT location_id FROM content_location_mapping WHERE content_id=1 ORDER BY location_id").all().map(row => row.location_id), [20])
  await assert.rejects(() => admin.adminUpsertContent({ data: { id: 1, name: 'Invalid archived selection', type: 'movie', location_ids: [20] } }), /existing locations/)

  runHeroRenderingGate(website)
  console.log(`BANNER_DESIGN_OK sqlite=actual transactions=atomic invalid=${invalid.length} auth=7 public_filters=active_deleted_child artwork=roundtrip statements=${statements.length}`)
} finally { database.close() }
