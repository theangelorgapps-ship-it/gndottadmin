#!/usr/bin/env node
// Executes the shipping SQL against SQLite with production's TEXT banner type IDs.
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const websiteRoot = process.env.HALOBOX_WEBSITE_ROOT ?? '/Users/charlesfinney/Documents/Codex/Projects/New project/gndott'
const { HERO_SQL_SCHEMA, createHeroHarness } = await import(pathToFileURL(resolve(websiteRoot, 'scripts/gate-hero-design.mjs')).href)
const migration = readFileSync(resolve(root, 'migrations/20261109_hero_connection.sql'), 'utf8')
const db = new DatabaseSync(':memory:')
const migrate = () => {
  db.exec('BEGIN IMMEDIATE')
  try { db.exec(migration); db.exec('COMMIT') } catch (error) { db.exec('ROLLBACK'); throw error }
}
try {
  db.exec(HERO_SQL_SCHEMA)
  db.exec(readFileSync(resolve(root, 'migrations/20261108_banner_design.sql'), 'utf8'))
  const title = db.prepare('INSERT INTO entertainments(id,name,type,total_views,poster_url,thumbnail_url,status,is_restricted) VALUES(?,?,?,?,?,?,?,?)')
  for (const [id,name,type,views,poster,thumb,status,child] of [
    [1,'Zulu legacy','movie',1,'/media/legacy-title.avif','/media/legacy-wide.avif',1,0],
    [2,'Alpha sermon','movie',90,'/media/a.avif','/media/a-wide.avif',1,0],
    [3,'Beta sermon','movie',80,'/media/b.avif','/media/b-wide.avif',1,1],
    [4,'Gamma sermon','movie',70,'/media/c.avif','/media/c-wide.avif',1,0],
    [5,'No artwork','movie',0,'','',1,0],
    [6,'Hidden sermon','movie',200,'/media/hidden.avif','',0,0],
    [7,'Alpha teaching','teaching',100,'/media/teaching.avif','',1,0],
    [8,'Beta teaching','teaching',10,'/media/teaching-b.avif','',1,0],
    [9,'Alpha show','tvshow',0,'/media/show.avif','',1,0],
    [10,'Zeta authored show','tvshow',0,'/media/authored.avif','',1,0],
  ]) title.run(id,name,type,views,poster,thumb,status,child)
  db.exec(`INSERT INTO videos(id,name,poster_url,status) VALUES(2,'Alpha video','/media/video.avif',1),(3,'Beta video','/media/video-b.avif',1),(4,'No artwork video','',1);
    INSERT INTO banners(id,title,type,type_id,banner_for,status,file_url,poster_url,deleted_at) VALUES
    (11,NULL,'movie','1','home',1,'/media/legacy-override.avif','/media/legacy-poster.avif',NULL),
    (12,'Existing match','movie','2','home',1,'','',NULL),
    (13,'Deleted history','movie','3','home',1,'','', '2026-01-01'),
    (14,'Hidden history','video','2','video',0,'','',NULL),
    (15,'Authored show','tvshow','10','tv_show',1,'/media/show-override.avif','',NULL);
    INSERT INTO banner_designs(banner_id,design_json) VALUES(15,'{"version":1,"devices":{"web":{"x":10,"y":20,"fit":"cover","align":"left"}}}');`)
  migrate()
  const hero = createHeroHarness(db)
  let home = await hero.loadConfiguredHeroes('home')
  assert.deepEqual(Array.from(home, row => row.id), [7,2,3,1], 'Original visible top three lead; legacy banner remains after them')
  assert.equal(home[1].banner_id, 12, 'Active matching title reused without duplicate')
  assert.equal(home.at(-1).thumbnail_url, '/media/legacy-override.avif', 'Legacy explicit override preserved')
  assert.equal(db.prepare('SELECT title FROM banners WHERE id=11').get().title, 'Zulu legacy')
  assert.equal(db.prepare('SELECT deleted_at FROM banners WHERE id=13').get().deleted_at, '2026-01-01')
  assert.equal(db.prepare('SELECT status FROM banners WHERE id=14').get().status, 0)
  assert.deepEqual(Array.from(await hero.loadConfiguredHeroes('home', true), row => row.id), [7,2,1])
  assert.deepEqual(Array.from(await hero.loadConfiguredHeroes('movie'), row => row.id), [2,3,4,1])
  assert.deepEqual(Array.from(await hero.loadConfiguredHeroes('teaching'), row => row.id), [7,8])
  assert.deepEqual(Array.from(await hero.loadConfiguredHeroes('video'), row => row.id), [2,3])
  assert.deepEqual(Array.from(await hero.loadConfiguredHeroes('tv_show'), row => row.id), [10], 'Already configured placement is not seeded')
  assert.equal((await hero.loadConfiguredHeroes('tv_show'))[0].hero_design.devices.web.x, 10)
  assert.ok(home.every(row => Number.isSafeInteger(row.id)), 'Runtime IDs match catalogue numeric IDs')
  db.exec("UPDATE entertainments SET thumbnail_url='/media/new-current.avif' WHERE id=7")
  assert.equal((await hero.loadConfiguredHeroes('home'))[0].thumbnail_url, '/media/new-current.avif')

  // Re-running after later editorial changes neither resets order/artwork nor
  // resurrects a hidden/deleted slide or imports new popularity selections.
  db.prepare("UPDATE banners SET deleted_at='2026-11-09',title='Editor changed title' WHERE id=?").run(home[0].banner_id)
  db.prepare('UPDATE banner_order SET sort_order=500 WHERE banner_id=?').run(home[1].banner_id)
  db.exec("UPDATE entertainments SET total_views=500 WHERE id=4")
  const snapshot = () => JSON.stringify({
    banners: db.prepare('SELECT * FROM banners ORDER BY id').all(),
    designs: db.prepare('SELECT * FROM banner_designs ORDER BY banner_id').all(),
    order: db.prepare('SELECT * FROM banner_order ORDER BY banner_id').all(),
    capture: db.prepare('SELECT * FROM banner_backfill_20261109 ORDER BY placement,sort_order').all(),
    sequence: db.prepare("SELECT * FROM sqlite_sequence WHERE name='banners'").all(),
  })
  const before = snapshot()
  migrate()
  assert.equal(snapshot(), before, 'Migration is idempotent even after live editorial changes')
  assert.equal(db.prepare('SELECT COUNT(*) n FROM banner_backfill_runs').get().n, 1)
  console.log('HERO_BACKFILL_OK sqlite=actual placements=5 text_ids=normalized legacy=preserved dedupe=active rerun=idempotent')
} finally { db.close() }
