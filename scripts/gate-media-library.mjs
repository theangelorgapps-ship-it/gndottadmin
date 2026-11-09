import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import ts from 'typescript'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

const root = process.cwd(); const require = createRequire(import.meta.url)
const sql = new DatabaseSync(':memory:')
sql.exec(readFileSync('migrations/20261108_media_library.sql','utf8'))
sql.exec('CREATE TABLE entertainments(id INTEGER PRIMARY KEY,poster_url TEXT,thumbnail_url TEXT); CREATE TABLE settings(name TEXT,val TEXT)')
sql.exec('CREATE TABLE banners(id INTEGER PRIMARY KEY); INSERT INTO banners(id) VALUES(1)')
sql.exec(readFileSync('migrations/20261108_banner_design.sql','utf8'))
let d1Queries=0;let failIndexKey=null
const database = {
  async all(query,...args) { d1Queries++; d1LikeLimit(query,args); return sql.prepare(query).all(...args) },
  async first(query,...args) { d1Queries++; d1LikeLimit(query,args); return sql.prepare(query).get(...args) ?? null },
  async run(query,...args) { d1Queries++; d1LikeLimit(query,args); if(failIndexKey && query.startsWith('INSERT INTO media_asset_index') && args[0]===failIndexKey){failIndexKey=null;throw Error('simulated interrupted discovery')} return sql.prepare(query).run(...args) },
}
// D1 differs from desktop SQLite: LIKE/GLOB patterns are capped at 50 bytes.
// All bound LIKE patterns in this leaf are %literal% strings. Exercise this
// limit so long migrated keys cannot break protected deletion in production.
function d1LikeLimit(query,args) {
  if (/\b(?:LIKE|GLOB)\s+\?/i.test(query)) for(const value of args) {
    if(typeof value==='string' && value.startsWith('%') && value.endsWith('%') && Buffer.byteLength(value)>50) throw new Error('D1 LIKE pattern exceeds 50 bytes')
  }
}
let request = new Request('https://fort.halobox.tv/api/upload',{ method:'POST',headers:{origin:'https://fort.halobox.tv'} })
let role = 'admin'; let currentUid = 1; let authorizedCalls = 0
const requireAdmin = async () => { authorizedCalls++; if (role !== 'admin') { const e = new Error('Forbidden'); e.code=role==='anonymous'?'needsAuth':'forbidden'; throw e }; return {uid:currentUid,email:'admin@example.test'} }
const createServerFn = () => { let validate = x=>x; return { validator(fn){validate=fn;return this}, handler(fn){return async input=>fn({data:validate(input?.data)})} } }
const records = new Map(); const deleted = []
const bucket = {
  async put(key,data,options={}) { const bytes = new Uint8Array(data); const etag=createHash('sha256').update(bytes).digest('hex'); const row={key,size:bytes.length,etag,uploaded:new Date(),httpMetadata:options.httpMetadata,bytes};records.set(key,row);return row },
  async head(key) { return records.get(key) ?? null },
  async get(key) { const row=records.get(key);return row?{...row,body:new Blob([row.bytes]).stream()}:null },
  async delete(key) { deleted.push(key); records.delete(key) },
  async list({limit,cursor}) { const sorted=[...records.values()].sort((a,b)=>a.key.localeCompare(b.key));const start=Number(cursor??0);const objects=sorted.slice(start,start+limit);return{objects,truncated:start+limit<sorted.length,cursor:String(start+limit)} },
}
const images = {
  async info(stream) { const bytes=await new Response(stream).arrayBuffer();return sharp(Buffer.from(bytes)).metadata() },
  input(stream) { return {transform(){return this},async output(){const bytes=await new Response(stream).arrayBuffer();const output=await sharp(Buffer.from(bytes)).avif({quality:75}).toBuffer();return{response:()=>new Response(output,{headers:{'content-type':'image/avif'}})}}} },
}
const environment={MEDIA:bucket,IMAGES:images}
const modules={}
function load(relative) {
  if(modules[relative]) return modules[relative]
  const module={exports:{}}
  const text=readFileSync(relative,'utf8')
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const localRequire=(id)=>{
    if(id==='cloudflare:workers')return{env:environment}
    if(id==='@tanstack/react-start')return{createServerFn}
    if(id==='@tanstack/react-start/server')return{getRequest:()=>request}
    if(id==='@tanstack/react-router')return{createFileRoute:()=>config=>config}
    if(id.endsWith('/admin'))return{requireAdmin}
    if(id.endsWith('/db'))return database
    if(id.endsWith('/media-library-core'))return load('src/lib/media-library-core.ts')
    if(id.endsWith('/media-library.server'))return load('src/lib/media-library.server.ts')
    if(id.endsWith('/media-library'))return load('src/lib/media-library.ts')
    return require(id)
  }
  vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,crypto:globalThis.crypto,Uint8Array,ArrayBuffer,DataView,TextDecoder,Date,Number,Math,Blob,File,Response,Request,URL,ReadableStream,console},{filename:relative})
  modules[relative]=module.exports;return module.exports
}
const core=load('src/lib/media-library-core.ts');const server={...load('src/lib/media-library.server.ts'),...load('src/lib/media-library.ts')};const route=load('src/routes/api/upload.ts')
const bytes = new Uint8Array(await sharp(Buffer.from('<svg width="1300" height="250" xmlns="http://www.w3.org/2000/svg"><rect width="1300" height="250" fill="white"/><text x="65" y="155" font-family="Arial" font-size="90" font-weight="700" fill="black">GRACE AND HOPE</text></svg>')).png().toBuffer())

// Actual decoding/encoding rather than checking extensions or string snippets.
const uploaded=await server.storeMediaUpload(new File([bytes],'opaque-749ab.png',{type:'image/png'}),1)
assert.match(uploaded.url,/\.avif$/)
const stored=records.get(uploaded.key)
assert.equal(core.imageSignature(stored.bytes),'avif');assert.equal(stored.httpMetadata.contentType,'image/avif')
assert.equal([...records].filter(([key])=>key.endsWith('.png')).length,0)
assert.equal((await sharp(stored.bytes).metadata()).format,'heif')
assert.throws(()=>core.classifyUpload('bad.png',new TextEncoder().encode('<script>evil</script>')),/contents/)
assert.throws(()=>core.classifyUpload('image.svg',new TextEncoder().encode('<svg/>')),/Choose a/)
assert.throws(()=>core.classifyUpload('movie.mp4',new Uint8Array([1,2,3])),/Bunny/)
assert.throws(()=>core.classifyUpload('fake.pdf',new TextEncoder().encode('html')),/valid PDF/)
assert.equal(core.classifyUpload('a.pdf',new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF')).kind,'document')
assert.equal(core.classifyUpload('a.vtt',new TextEncoder().encode('WEBVTT\n\n00:00.000 --> 00:01.000\nHello')).kind,'subtitle')
assert.equal(core.classifyUpload('a.srt',new TextEncoder().encode('1\n00:00:00,000 --> 00:00:01,000\nHello')).kind,'subtitle')
assert.throws(()=>core.classifyUpload('a.vtt',new TextEncoder().encode('WEBVTT\n<script>x</script>')),/Unsupported/)
assert.throws(()=>core.classifyUpload('a.srt',new Uint8Array([255,255])),/UTF-8/)
assert.throws(()=>core.classifyUpload('a.srt',new TextEncoder().encode('not a subtitle')),/invalid/)
for(const key of ['private/a.avif','PRIVATE/a.avif','../a.png','x/%2e.png','x/../a.png','x\\a.png','x//a.png'])assert.equal(core.publicMediaKey(key),false,key)
for(const data of [null,[],{from:2026},{from:'2026-02-30'},{from:'2026-12-01',to:'2026-01-01'},{mode:'sql'},{offset:-1},{kind:'script'}])assert.throws(()=>core.validFilters(data))

// Multipart auth/origin/size boundaries are checked before any object is stored.
const post=(origin='https://fort.halobox.tv',blob=new File([bytes],'photo.png',{type:'image/png'}))=>{const form=new FormData();form.append('file',blob);return new Request('https://fort.halobox.tv/api/upload',{method:'POST',headers:origin?{origin}:{},body:form})}
const count=records.size
request=post('https://evil.example');assert.equal((await route.handleMediaUpload(request)).status,403);assert.equal(records.size,count)
request=post('');assert.equal((await route.handleMediaUpload(request)).status,403)
request=post();role='anonymous';assert.equal((await route.handleMediaUpload(request)).status,401)
role='demo_admin';assert.equal((await route.handleMediaUpload(request)).status,403)
role='admin';request=post();assert.equal((await route.handleMediaUpload(request)).status,200)
request=new Request('https://fort.halobox.tv/api/upload',{method:'POST',headers:{origin:'https://fort.halobox.tv','content-type':'multipart/form-data; boundary=x','content-length':String(core.MAX_REQUEST+1)},body:'x'})
assert.equal((await route.handleMediaUpload(request)).status,413)
request=post('https://fort.halobox.tv',new File(['<script>oops</script>'],'fake.png',{type:'image/png'}));assert.equal((await route.handleMediaUpload(request)).status,415)
request=new Request('https://fort.halobox.tv/api/upload',{method:'POST',headers:{origin:'https://fort.halobox.tv','content-type':'application/json'},body:'{}'});assert.equal((await route.handleMediaUpload(request)).status,415)
await assert.rejects(()=>core.boundedBytes(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(11));controller.close()}}),10),/too large/)
const originalImages=environment.IMAGES;delete environment.IMAGES
await assert.rejects(()=>server.storeMediaUpload(new File([bytes],'photo.png'),1),/not configured/)
environment.IMAGES={...originalImages,input(){return{transform(){return this},async output(){return{response:()=>new Response(bytes)}}}}}
await assert.rejects(()=>server.storeMediaUpload(new File([bytes],'photo.png'),1),/did not produce AVIF/)
environment.IMAGES=originalImages

// Persisted discovery traverses >200 migrated files and excludes private records.
for(let i=0;i<215;i++){const key=`legacy-20261105/${String(i).padStart(4,'0')}.png`;await bucket.put(key,bytes);records.get(key).uploaded=new Date(i<100?'2022-01-04T12:00:00Z':'2023-05-06T12:00:00Z')}
await bucket.put('private/secret.png',bytes)
request=post();let discovered;let maxDiscoveryQueries=0
const discoverPage=async(data={})=>{
  const before=d1Queries
  try{return await server.discoverMediaBatch({data})}
  finally{
    const used=d1Queries-before;maxDiscoveryQueries=Math.max(maxDiscoveryQueries,used)
    // The app auth/session layer is stubbed here: reserve ten additional D1
    // queries for it and enforce <=40 including that conservative allowance.
    assert.ok(used+10<=40,`Discovery used ${used} media queries plus ten reserved auth queries`)
  }
}
discovered=await discoverPage()
assert.equal(discovered.finished,false)
assert.equal(discovered.discovered,core.SCAN_BATCH_SIZE)
const savedCursor=sql.prepare('SELECT cursor,discovered FROM media_scan_state WHERE id=1').get()
assert.ok(savedCursor.cursor)
// A failure after two upserts must neither move the cursor nor duplicate files
// when the next invocation retries the same page.
failIndexKey=[...records.keys()].sort().slice(Number(savedCursor.cursor))[2]
await assert.rejects(()=>discoverPage(),/interrupted discovery/)
assert.deepEqual(sql.prepare('SELECT cursor,discovered FROM media_scan_state WHERE id=1').get(),savedCursor)
assert.equal(sql.prepare('SELECT lease FROM media_scan_state WHERE id=1').get().lease,null)
for(let i=0;i<Math.ceil(records.size/core.SCAN_BATCH_SIZE)+1;i++){discovered=await discoverPage();if(discovered.finished)break}
assert.equal(discovered.finished,true);assert.equal(discovered.discovered,records.size-1)
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM media_asset_index').get().n,records.size-1)
const completedState=sql.prepare('SELECT generation,cursor,discovered FROM media_scan_state WHERE id=1').get()
const noOp=await discoverPage();assert.equal(noOp.added,0)
assert.deepEqual(sql.prepare('SELECT generation,cursor,discovered FROM media_scan_state WHERE id=1').get(),completedState)
// Refresh scans remain idempotent and keep recognized text for unchanged ETags.
sql.prepare("UPDATE media_asset_index SET ocr_status='ready',ocr_text='RETAINED PIXELS',confidence=90 WHERE key=?").run('legacy-20261105/0000.png')
discovered=await discoverPage({restart:true})
assert.equal(sql.prepare('SELECT generation FROM media_scan_state WHERE id=1').get().generation,completedState.generation+1)
for(let i=0;!discovered.finished && i<Math.ceil(records.size/core.SCAN_BATCH_SIZE);i++)discovered=await discoverPage()
assert.equal(discovered.finished,true);assert.equal(discovered.discovered,records.size-1)
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM media_asset_index').get().n,records.size-1)
assert.equal(sql.prepare('SELECT ocr_text FROM media_asset_index WHERE key=?').get('legacy-20261105/0000.png').ocr_text,'RETAINED PIXELS')
const validList=bucket.list;const beforeBadPage=sql.prepare('SELECT generation,cursor,discovered FROM media_scan_state WHERE id=1').get()
bucket.list=async()=>({objects:[...records.values()].slice(0,core.SCAN_BATCH_SIZE+1),truncated:true,cursor:'skip-too-far'})
try{await assert.rejects(()=>discoverPage({restart:true}),/invalid page/)}finally{bucket.list=validList}
assert.deepEqual(sql.prepare('SELECT generation,cursor,discovered FROM media_scan_state WHERE id=1').get(),beforeBadPage)
assert.ok(maxDiscoveryQueries<=26)
assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM media_asset_index WHERE key LIKE 'private/%'").get().n,0)
const byDate=await server.listMediaLibrary({data:{folder:'legacy-20261105',from:'2022-01-01',to:'2022-12-31'}})
assert.equal(byDate.total,100);assert.equal(byDate.assets.length,48)
const nextPage=await server.listMediaLibrary({data:{folder:'legacy-20261105',from:'2022-01-01',to:'2022-12-31',offset:48}})
assert.notEqual(nextPage.assets[0].key,byDate.assets[0].key)
assert.equal((await server.listMediaLibrary({data:{mode:'filename',query:'%'}})).total,0)
const imagePage=await server.listMediaLibrary({data:{kind:'image',mode:'filename',query:'000'}})
assert.ok(imagePage.assets.length>0);assert.ok(imagePage.assets.every(asset=>asset.kind==='image'))
assert.equal((await server.listMediaLibrary({data:{kind:'subtitle'}})).total,0,'picker filters are applied before pagination')
assert.equal((await server.listMediaLibrary({data:{query:'749ab'}})).total,0,'filenames must not masquerade as OCR')
assert.equal((await server.listMediaLibrary({data:{query:'long genuine image text query '.repeat(4)}})).ok,true,'valid OCR searches must respect the D1 pattern limit')

// Real Tesseract reads pixels from an opaque image with no matching filename/metadata.
for(const file of ['public/ocr/lang/eng.traineddata.gz','public/ocr/worker.min.js','public/ocr/core/tesseract-core-lstm.wasm.js'])assert.ok(existsSync(file),`Missing self-hosted OCR asset: ${file}`)
const workdir=mkdtempSync(path.join(tmpdir(),'halobox-ocr-gate-'))
let ocr
try {
  ocr=await createWorker('eng',1,{langPath:path.join(root,'public/ocr/lang'),cachePath:workdir})
  const result=await ocr.recognize(Buffer.from(bytes))
  assert.match(result.data.text,/GRACE AND HOPE/)
  let jobs=await server.claimMediaOcr({data:{}});assert.equal(jobs.length,core.OCR_BATCH_SIZE)
  const job=jobs[0]
  currentUid=2
  await assert.rejects(()=>server.completeMediaOcr({data:{...job,text:result.data.text,confidence:result.data.confidence}}),/expired/)
  currentUid=1
  const concurrent=await server.claimMediaOcr({data:{}})
  assert.ok(concurrent.every(item=>!jobs.some(original=>original.key===item.key)))
  await server.releaseMediaOcr({data:concurrent.map(({key,lease})=>({key,lease}))})
  await assert.rejects(()=>server.completeMediaOcr({data:{...job,lease:crypto.randomUUID(),text:result.data.text,confidence:result.data.confidence}}),/expired/)
  await server.completeMediaOcr({data:{...job,text:result.data.text,confidence:result.data.confidence}})
  const found=await server.listMediaLibrary({data:{query:'GRACE AND HOPE'}})
  assert.equal(found.total,1);assert.equal(found.assets[0].key,job.key)
  assert.equal(found.assets[0].ocr_status,'ready');assert.ok(!job.key.includes('GRACE'))
  await assert.rejects(()=>server.completeMediaOcr({data:{...job,text:'replayed',confidence:90}}),/expired/)
  await server.releaseMediaOcr({data:jobs.slice(1).map(({key,lease})=>({key,lease}))})
  assert.equal(sql.prepare('SELECT ocr_status FROM media_asset_index WHERE key=?').get(jobs[1].key).ocr_status,'pending')
  jobs=await server.claimMediaOcr({data:{}})
  const failed=jobs[0];await server.completeMediaOcr({data:{...failed,error:'Decoder unavailable'}})
  assert.equal(sql.prepare('SELECT ocr_status FROM media_asset_index WHERE key=?').get(failed.key).ocr_status,'error')
  await server.releaseMediaOcr({data:jobs.slice(1).map(({key,lease})=>({key,lease}))})
  const stale=(await server.claimMediaOcr({data:{}}))[0]
  await bucket.put(stale.key,new Uint8Array([...bytes,1]))
  await assert.rejects(()=>server.completeMediaOcr({data:{...stale,text:'OLD PIXELS',confidence:90}}),/changed/)
  assert.equal(sql.prepare('SELECT ocr_status FROM media_asset_index WHERE key=?').get(stale.key).ocr_status,'pending')
}finally{await ocr?.terminate();rmSync(workdir,{recursive:true,force:true})}

// Referenced files cannot be deleted; private, foreign and stale claims fail closed.
const target=records.get(uploaded.key)
sql.prepare('INSERT INTO entertainments(id,poster_url) VALUES(1,?)').run(uploaded.url)
await assert.rejects(()=>server.deleteLibraryMedia({data:{key:uploaded.key,etag:target.etag}}),/still used/)
sql.exec('DELETE FROM entertainments')
// Device-specific artwork is a live content reference even if banners.file_url is blank.
sql.prepare('INSERT INTO banner_designs(banner_id,design_json) VALUES(1,?)').run(JSON.stringify({version:1,devices:{phone:{image:uploaded.url,x:50,y:50,fit:'cover',align:'center'}}}))
await assert.rejects(()=>server.deleteLibraryMedia({data:{key:uploaded.key,etag:target.etag}}),/still used/)
assert.equal(records.has(uploaded.key),true)
sql.exec('DELETE FROM banner_designs')
sql.prepare('INSERT INTO entertainments(id,poster_url) VALUES(1,?)').run('/media/legacy/art work.png')
await assert.rejects(()=>server.assertMediaUnused('legacy/art work.png'),/still used/)
sql.exec('DELETE FROM entertainments')
await assert.rejects(()=>server.deleteLibraryMedia({data:{key:'private/secret.png',etag:'a'}}),/Invalid/)
await assert.rejects(()=>server.deleteLibraryMedia({data:{key:uploaded.key,etag:'stale'}}),/no longer/)
await server.deleteLibraryMedia({data:{key:uploaded.key,etag:target.etag}})
assert.equal(records.has(uploaded.key),false)
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM media_asset_index WHERE key=?').get(uploaded.key).n,0)
assert.equal(records.has('private/secret.png'),true)
const pendingJob=(await server.claimMediaOcr({data:{}}))[0]
sql.prepare('UPDATE media_asset_index SET lease_until=0 WHERE key=?').run(pendingJob.key)
const reclaimed=await server.claimMediaOcr({data:{}})
assert.ok(reclaimed.some(item=>item.key===pendingJob.key && item.lease!==pendingJob.lease))
await assert.rejects(()=>server.completeMediaOcr({data:{...pendingJob,text:'stale',confidence:90}}),/expired/)
await server.releaseMediaOcr({data:reclaimed.map(({key,lease})=>({key,lease}))})
role='anonymous';await assert.rejects(()=>server.listMediaLibrary({data:{}}),/Forbidden/);role='admin'
for(let i=0;i<12;i++)await server.mediaRateLimit(77,'limited',12)
await assert.rejects(()=>server.mediaRateLimit(77,'limited',12),/wait a minute/)
assert.ok(authorizedCalls>15)
assert.ok(sql.prepare('SELECT COUNT(*) AS n FROM media_audit_events').get().n>=3)

// Integration contracts: no CDN or filename text used by browser recognition.
const ui=readFileSync('src/routes/admin/media-library.tsx','utf8')
assert.match(ui,/engine\.recognize\(canvas\)/);assert.match(ui,/createImageBitmap\(blob\)/);assert.match(ui,/workerPath: '\/ocr\/worker\.min\.js'/)
const dialog=readFileSync('src/components/UploadDialog.tsx','utf8')
assert.match(dialog,/createPortal/);assert.match(dialog,/request\.upload\.onprogress/);assert.match(dialog,/xhr\.current\?\.abort/)
assert.doesNotMatch(dialog,/<form/)

// The operational migrated-image backfill has no application session, is
// read-only by default, and never steals an active UI OCR lease or stale ETag.
const operation=await import('./index-migrated-media.mjs')
assert.equal(operation.parseOptions([]).apply,false)
assert.equal(operation.parseOptions([]).limit,100)
for(const flags of [['--limit','101'],['--workers','3'],['--apply','--preview-ocr'],['--endpoint','https://evil.example']])assert.throws(()=>operation.parseOptions(flags))
const object={key:'avif/v1/'+ 'a'.repeat(64)+'.avif',etag:'e'.repeat(32),size:1000,last_modified:'2026-11-08T03:59:13.092Z'}
assert.equal(operation.publicImage(object),true)
assert.equal(operation.publicImage({...object,key:'private/photo.avif'}),false)
assert.equal(operation.publicImage({...object,key:'PRIVATE/photo.avif'}),false)
assert.equal(operation.publicImage({...object,key:'avif/photo.avif/../../settings.json'}),false)
assert.equal(operation.publicImage({...object,size:11*1024*1024}),false)
assert.equal(operation.needsOcr(object,{etag:object.etag,ocr_status:'ready'}),false)
assert.equal(operation.needsOcr(object,{etag:object.etag,ocr_status:'error'}),false)
assert.equal(operation.needsOcr(object,{etag:object.etag,ocr_status:'error'},true),true)
assert.equal(operation.needsOcr(object,{etag:'old',ocr_status:'processing',lease:'browser',lease_until:200},false,100),false)
assert.equal(operation.needsOcr(object,{etag:object.etag,ocr_status:'processing',lease:'browser',lease_until:99},false,100),true)
const result={status:'ready',text:'REAL PIXELS',confidence:88,error:null}
const applyStatement=(snapshot,out=result)=>{const s=operation.resultStatement(object,snapshot,out,100);assert.ok(s.params.length<100);return sql.prepare(s.sql).all(...s.params)}
assert.equal(applyStatement(null).length,1)
assert.equal(applyStatement({etag:object.etag},{...result,text:'DO NOT OVERWRITE'}).length,0)
assert.equal(sql.prepare('SELECT ocr_text FROM media_asset_index WHERE key=?').get(object.key).ocr_text,'REAL PIXELS')
sql.prepare("UPDATE media_asset_index SET ocr_status='processing',lease='browser',lease_until=200 WHERE key=?").run(object.key)
assert.equal(applyStatement({etag:object.etag}).length,0)
sql.prepare('UPDATE media_asset_index SET lease_until=99 WHERE key=?').run(object.key)
assert.equal(applyStatement({etag:'stale-version'}).length,0)
assert.equal(applyStatement({etag:object.etag}).length,1)
assert.equal(sql.prepare('SELECT lease,lease_owner FROM media_asset_index WHERE key=?').get(object.key).lease_owner,null)
let networkCalls=0
const readOnly=operation.createCloudflare('unit-test-token',false,async()=>{networkCalls++;throw Error('unexpected network')})
await assert.rejects(()=>readOnly.write(object,{etag:object.etag},result),/Read-only/)
assert.equal(networkCalls,0,'dry-run write protection must run before network')
const staleCloud=operation.createCloudflare('unit-test-token',false,async()=>new Response(new Uint8Array(1000),{headers:{etag:'"new-version"'}}))
await assert.rejects(()=>staleCloud.bytes(object),/changed/)
const missingCloud=operation.createCloudflare('unit-test-token',false,async()=>new Response(JSON.stringify({success:true,result:[]}),{headers:{'content-type':'application/json'}}))
assert.equal(await missingCloud.unchanged(object),false)
// A clean account without the migration still supports a harmless inventory.
// Probe sqlite_master first; do not query an absent table or mislabel API/auth
// failures as a missing migration. Preview remains usable before deployment.
const schemaCloud=tables=>operation.createCloudflare('unit-test-token',false,async(_url,init)=>{
  const statement=JSON.parse(init.body)
  assert.match(statement.sql,/^SELECT name FROM sqlite_master/)
  assert.deepEqual(statement.params,['media_asset_index','media_scan_state'])
  return new Response(JSON.stringify({success:true,result:[{success:true,results:tables.map(name=>({name})),meta:{rows_written:0}}]}),{headers:{'content-type':'application/json'}})
})
assert.equal(await schemaCloud([]).schemaReady(),false)
assert.equal(await schemaCloud(['media_asset_index']).schemaReady(),false)
assert.equal(await schemaCloud(['media_scan_state','media_asset_index']).schemaReady(),true)
const authFailure=operation.createCloudflare('unit-test-token',false,async()=>new Response(null,{status:403}))
await assert.rejects(()=>authFailure.schemaReady(),/HTTP 403/)
let absentRows=0;let absentWrites=0
const reports=[]
const noMigration={
  inventory:async()=>[object],schemaReady:async()=>false,
  rows:async()=>{absentRows++;throw Error('absent table queried')},
  write:async()=>{absentWrites++;throw Error('unexpected write')},
}
const report=line=>reports.push(JSON.parse(line))
await operation.main([],{cloud:noMigration,report})
assert.equal(reports.length,1);assert.equal(reports[0].migrationReady,false)
assert.equal(reports[0].publicImages,1);assert.equal(reports[0].remoteWrites,0)
assert.match(reports[0].message,/migration is missing/)
await assert.rejects(()=>operation.main(['--apply'],{cloud:noMigration,report}),/migration is missing/)
assert.equal(absentRows,0);assert.equal(absentWrites,0)
reports.length=0
await operation.main(['--preview-ocr'],{cloud:{...noMigration,inventory:async()=>[]},report})
assert.equal(reports.length,2,'local preview continues beyond the missing-migration notice')
assert.equal(reports[1].mode,'local-ocr-preview');assert.equal(reports[1].ready,null)
assert.equal(reports[1].migrationReady,false);assert.equal(reports[1].selected,0)
assert.equal(absentRows,0);assert.equal(absentWrites,0)
reports.length=0
await assert.rejects(()=>operation.main([],{cloud:{...noMigration,schemaReady:()=>authFailure.schemaReady()},report}),/HTTP 403/)
assert.equal(reports.length,0,'authentication failures must not be reported as missing migration')
let presentRows=0
await operation.main([],{cloud:{...noMigration,schemaReady:async()=>true,rows:async()=>{presentRows++;return new Map([[object.key,{etag:object.etag,ocr_status:'ready'}]])}},report})
assert.equal(presentRows,1);assert.equal(reports[0].migrationReady,true)
assert.equal(reports[0].ready,1);assert.equal(reports[0].selected,0)
console.log(`MEDIA_LIBRARY_OK: AVIF encoder, signatures, bounded upload, auth/CSRF/rate limit, >200 migrated discovery (${maxDiscoveryQueries} D1 queries + ten reserved for auth), cursor retry/refresh, persisted dates/folders, real pixel OCR, stale/foreign claims, protected deletion, D1 limits, dry-run backfill and popup contract`)
