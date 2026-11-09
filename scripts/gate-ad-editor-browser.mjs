// Production route/editor with local RPC fixtures: no live account or ad writes.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-ad-editor-'))
let server, browser
try {
  const fixture = `export const adminTable=async()=>[];export const adminGetRow=async()=>({id:1,name:'Existing campaign',type:'image',media:'/media/ad.avif',placement:'home_page',is_enable:'0',status:'0'});export const adminUpsertRow=async({data})=>{window.saved=data;return {ok:true}};export const adminDeleteRow=async()=>({ok:true});`
  await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{Route}from'./src/routes/admin/custom-ads';const Page=Route.component;createRoot(document.getElementById('app')).render(<Page/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outdir: temporary, platform: 'browser', format: 'esm', jsx: 'automatic', plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({filter:/lib\/admin$/},()=>({path:'admin',namespace:'fixture'}))
    b.onResolve({filter:/lib\/media-library$/},()=>({path:'media',namespace:'fixture'}))
    b.onResolve({filter:/^@tanstack\/react-router$/},()=>({path:'router',namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:path==='admin'?fixture:path==='media'?'export const listMediaLibrary=async()=>({ok:true,assets:[],folders:[]})':`export const Link=({children})=>children;export const createFileRoute=()=>options=>({...options,useLoaderData:()=>[{id:1,name:'Existing campaign',type:'image',is_enable:'0',status:'0'}]});export const useRouter=()=>({invalidate:()=>{window.invalidated=true}});`}))
  }}] })
  server=createServer((req,res)=>{
    if(req.url==='/stdin.js'||req.url==='/stdin.css'){res.setHeader('content-type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(path.join(temporary,req.url)));return}
    if(req.url.startsWith('/media/')){res.statusCode=404;res.end();return}
    res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/stdin.css"><style>body{font:16px system-ui;background:#090b12;color:white}dialog{max-height:85dvh;width:min(680px,85vw);overflow:auto}.form-grid{display:grid;gap:12px}.mfield label{display:block}button,input,select{font:inherit;padding:8px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="app"></div><script type="module" src="/stdin.js"></script></body></html>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'})
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.setDefaultTimeout(6000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  // Asset requests stay local even when the production media helper resolves its canonical host.
  await page.route('https://halobox.tv/**',route=>route.fulfill({status:404,body:''}))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('button',{name:'Edit Existing campaign',exact:true}).click()
  const dialog=page.getByRole('dialog')
  assert.equal(await dialog.getByLabel('Enabled',{exact:true}).inputValue(),'0')
  assert.equal(await dialog.getByLabel('Status',{exact:true}).inputValue(),'0')
  assert.equal(await dialog.getByRole('textbox',{name:/Media image or video URL/}).inputValue(),'/media/ad.avif')
  await dialog.getByLabel('Enabled',{exact:true}).selectOption('1')
  await dialog.getByLabel('Status',{exact:true}).selectOption('1')
  await dialog.getByLabel('Destination',{exact:true}).fill('/shop')
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await page.waitForFunction(()=>window.invalidated===true)
  const saved=await page.evaluate(()=>window.saved)
  assert.equal(saved.values.is_enable,1);assert.equal(saved.values.status,1);assert.equal(saved.values.media,'/media/ad.avif');assert.equal(saved.values.redirect_url,'/shop')
  await page.getByRole('button',{name:/Add custom ad/}).click()
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await dialog.getByRole('alert').waitFor()
  await page.setViewportSize({width:390,height:844})
  assert.equal(await dialog.evaluate(el=>el.getBoundingClientRect().right<=innerWidth),true)
  await page.keyboard.press('Escape')
  assert.equal(await dialog.count(),0)
  assert.deepEqual(errors,[])
  console.log('AD_EDITOR_BROWSER_OK: inactive string values, image/destination/enabled save payload, invalidation, required fields, mobile dialog and Escape')
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true})}
