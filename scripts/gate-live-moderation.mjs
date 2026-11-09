// Exercise shipping handlers and the idempotent migration using real SQLite.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const sql = new DatabaseSync(':memory:')
sql.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,first_name TEXT,last_name TEXT,user_type TEXT,status INTEGER,is_banned INTEGER,deleted_at TEXT);
INSERT INTO users VALUES(1,'admin@example.test','Admin','','admin',1,0,NULL),(2,'mod@example.test','Mod','','user',1,0,NULL),(3,'viewer@example.test','Viewer','','user',1,0,NULL),(4,'demo@example.test','Demo','','demo_admin',1,0,NULL);
CREATE TABLE live_tv_channel(id INTEGER PRIMARY KEY,name TEXT,status INTEGER,deleted_at TEXT);
INSERT INTO live_tv_channel VALUES(10,'Channel A',1,NULL),(20,'Channel B',1,NULL);
CREATE TABLE live_comments(id INTEGER PRIMARY KEY,channel_id INTEGER,user_id INTEGER,author_name TEXT,body TEXT,hidden INTEGER DEFAULT 0,pinned INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO live_comments(id,channel_id,user_id,author_name,body) VALUES(1,10,3,'Viewer','Hello'),(2,20,3,'Viewer','Other channel'),(3,10,1,'Admin','Notice');
CREATE TABLE live_comment_reports(id INTEGER PRIMARY KEY,channel_id INTEGER,comment_id INTEGER,reason TEXT,detail TEXT,status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP,resolved_by INTEGER);
INSERT INTO live_comment_reports(id,channel_id,comment_id,reason,detail) VALUES(1,10,1,'spam','Repeated'),(2,20,2,'spam','Repeated');
CREATE TABLE live_chat_mutes(channel_id INTEGER,user_id INTEGER,moderator_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(channel_id,user_id));
CREATE TABLE live_moderation_log(id INTEGER PRIMARY KEY,channel_id INTEGER,admin_id INTEGER,action TEXT,target_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`)
const migration = readFileSync('migrations/20261109_live_moderators.sql','utf8')
sql.exec(migration); sql.exec(migration)
let session = null, crossSite = false, failAudit = false
const database = {
 first: async (q,...p) => sql.prepare(q).get(...p) ?? null,
 all: async(q,...p) => sql.prepare(q).all(...p),
 run: async(q,...p) => sql.prepare(q).run(...p),
}
const d1 = {
 prepare: q => ({bind:(...p)=>({q,p,first:async()=>sql.prepare(q).get(...p)??null,all:async()=>({results:sql.prepare(q).all(...p)}),run:async()=>sql.prepare(q).run(...p)})}),
 batch: async statements => {
  sql.exec('BEGIN')
  try { const result = statements.map(({q,p})=> {
   if(failAudit && q.includes('INSERT INTO live_moderation_log')) throw new Error('audit unavailable')
   return {meta:sql.prepare(q).run(...p)}
  }); sql.exec('COMMIT');return result } catch(e) { sql.exec('ROLLBACK');throw e }
 }
}
const factory = () => { let check=x=>x;return{validator(fn){check=fn;return this},handler(fn){return async input=>fn({data:check(input?.data)})}} }
const mocks = {
 '@tanstack/react-start':{createServerFn:factory},
 '@tanstack/react-start/server':{setResponseHeader(){},getRequest:()=>({method:'POST',url:'https://fort.halobox.tv',headers:new Headers({origin:crossSite?'https://evil.test':'https://fort.halobox.tv','sec-fetch-site':crossSite?'cross-site':'same-origin'})})},
 'cloudflare:workers':{env:{DB:d1}}, './session.server':{getSession:async()=>session}, './db':database,
}
function load(file, replacements) { const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n in replacements?replacements[n]:require(n),URL,console});return module.exports }
const auth=load('src/lib/better-auth-core.ts',{'better-auth':{},'better-auth/api':{},'better-auth/plugins':{},'bcryptjs':{}})
const admin=load('src/lib/admin.ts',{...mocks,'@tanstack/react-start':{createServerFn:factory,createServerOnlyFn:fn=>fn},'./live-sources':{},'./rich-text':{},'./series-validation':{},'./bunny':{},'./banner-design':{},'./locations-validation':{}})
const module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/live-moderation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n),URL,console})
const api=module.exports
const act=(action,targetId=1,channelId=10)=>api.updateLiveModeration({data:{action,targetId,channelId}})
await assert.rejects(act('hide'),/Sign in/)
session={uid:3}; assert.equal(await api.getWorkspaceSession(),null)
await assert.rejects(api.getLiveModeration({data:{channelId:10}}),/access/)
session={uid:4}; await assert.rejects(act('hide'),/read.only/)
session={uid:1}; crossSite=true;await assert.rejects(act('hide'),/request/);crossSite=false
await api.setLiveModerator({data:{channelId:10,email:' MOD@example.test ',enabled:true}})
assert.equal(sql.prepare('SELECT COUNT(*) n FROM live_chat_moderators').get().n,1)
session={uid:2};assert.equal((await api.getWorkspaceSession()).workspaceRole,'moderator')
assert.equal((await auth.eligibleUser(d1,2,'admin')).id,2)
assert.equal(await admin.getAdminSession(),null)
await assert.rejects(admin.requireAdmin(),/Admin access/)
await assert.rejects(admin.adminTable({data:{table:'users'}}),/Unauthorized|auth|access/i)
sql.exec('UPDATE users SET is_banned=1 WHERE id=2');assert.equal(await auth.eligibleUser(d1,2,'admin'),null);assert.equal(await api.getWorkspaceSession(),null);sql.exec('UPDATE users SET is_banned=0 WHERE id=2')
assert.equal((await api.getModerationChannels()).length,1)
assert.equal((await api.getLiveModeration({data:{channelId:10}})).comments.length,2)
await assert.rejects(act('hide',2,20),/access/)
await assert.rejects(act('hide',2,10),/not found/)
await assert.rejects(act('resolve',2,10),/not found/)
await assert.rejects(act('mute',3,10),/administrators|staff/)
await assert.rejects(api.setLiveModerator({data:{channelId:20,email:'viewer@example.test',enabled:true}}),/administrator/)
failAudit=true;await assert.rejects(act('hide'),/audit/);assert.equal(sql.prepare('SELECT hidden FROM live_comments WHERE id=1').get().hidden,0);failAudit=false
await act('hide');assert.equal(sql.prepare('SELECT hidden FROM live_comments WHERE id=1').get().hidden,1)
await act('restore');await act('mute');assert.equal(sql.prepare('SELECT COUNT(*) n FROM live_chat_mutes').get().n,1)
await act('unmute');assert.equal(sql.prepare('SELECT COUNT(*) n FROM live_chat_mutes').get().n,0)
await act('resolve');assert.equal(sql.prepare('SELECT status FROM live_comment_reports WHERE id=1').get().status,'resolved')
session={uid:1};await api.setLiveModerator({data:{channelId:10,userId:2,enabled:false}})
session={uid:2};assert.equal(await auth.eligibleUser(d1,2,'admin'),null);assert.equal(await api.getWorkspaceSession(),null);await assert.rejects(act('hide'),/access/)
session={uid:1};await assert.rejects(api.setLiveModerator({data:{channelId:10,email:'absent@example.test',enabled:true}}),/existing/)
await assert.rejects(act('drop'));await assert.rejects(act('hide',-1));await assert.rejects(api.getLiveModeration({data:{channelId:10,search:'a'.repeat(201)}}))
assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0)
console.log('LIVE_MODERATION_OK: channel scope, assignment/revocation, full-admin-only grants, demo/CSRF denial, target isolation, restricted posting state, atomic audit and validation')
