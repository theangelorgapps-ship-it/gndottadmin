// Isolated browser interaction gate. Fixture responses are test-only; gate-media-library exercises the real upload/storage pipeline.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import sharp from 'sharp'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = process.cwd(); const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-rich-media-'))
const imageBytes = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#526fbd' } }).avif().toBuffer()
let queries = []; let uploads = 0; let browser; let server
try {
  await build({ stdin: { contents: `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{UploadDialog}from'./src/components/UploadDialog';import{RichTextEditor}from'./src/components/RichTextEditor';
  function App(){const[value,setValue]=useState('/media/current.avif');const[open,setOpen]=useState(false);const[html,setHtml]=useState('<p>Original <strong>formatting</strong></p>');window.testState={value,html};return <main><form onSubmit={e=>{e.preventDefault();window.submits=(window.submits||0)+1}}><label>Content</label><RichTextEditor id="test-editor" label="Content" value={html} onChange={setHtml}/><button type="button" onClick={()=>setOpen(true)}>Choose image</button><UploadDialog open={open} currentValue={value} accept="image/*" onClose={()=>setOpen(false)} onUploaded={url=>{setValue(url);setOpen(false)}}/></form></main>};createRoot(document.getElementById('app')).render(<App/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, outdir: temporary, platform: 'browser', format: 'esm', jsx: 'automatic', plugins: [{ name: 'fixture-library', setup(builder) { builder.onResolve({ filter: /lib\/media-library$/ }, () => ({ path: 'library', namespace: 'fixture' })); builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const listMediaLibrary=async({data})=>{const response=await fetch("/test-library?"+new URLSearchParams(data));return response.json()}', loader: 'js' })) } }] })
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/stdin.css"><style>body{margin:0;padding:22px;background:#0c111d;color:white;font:14px system-ui}main{max-width:750px;margin:auto}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}button{cursor:pointer}</style></head><body><div id="app"></div><script type="module" src="/stdin.js"></script></body></html>'); return }
    if (url.pathname.startsWith('/media/')) { response.setHeader('content-type','image/avif'); response.end(imageBytes); return }
    if (url.pathname === '/test-library') {
      queries.push(Object.fromEntries(url.searchParams)); const query = url.searchParams.get('query') || ''
      const assets = ['first.avif', 'second.avif'].filter(name => name.includes(query)).map(name => ({ key: 'uploads/' + name, url: '/media/' + name, name, folder: 'uploads', kind: 'image', size: imageBytes.length }))
      response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ok:true,assets,total:assets.length,folders:[{folder:'uploads'}]}));return
    }
    if (url.pathname === '/api/upload') {
      const chunks=[];for await(const chunk of request)chunks.push(chunk);uploads++
      const form = await new Response(Buffer.concat(chunks),{headers:{'content-type':request.headers['content-type']}}).formData()
      assert.ok(form.get('file') instanceof File);assert.equal(form.get('file').name,'test.avif')
      response.setHeader('content-type','application/json');response.statusCode=uploads===1?503:200
      response.end(JSON.stringify(uploads===1?{ok:false,error:'Storage temporarily unavailable.'}:{ok:true,url:'/media/uploaded.avif'}));return
    }
    if (url.pathname === '/stdin.js' || url.pathname === '/stdin.css') { response.setHeader('content-type', url.pathname.endsWith('.js')?'text/javascript':'text/css');response.end(readFileSync(path.join(temporary,url.pathname)));return }
    response.statusCode=404;response.end()
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});const page=await browser.newPage({viewport:{width:1100,height:850}});const errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)})
  await page.route('https://halobox.tv/media/**',route=>route.fulfill({contentType:'image/avif',body:imageBytes}))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const editor=page.getByRole('textbox',{name:'Content',exact:true});await editor.waitFor().catch(async error=>{console.error(await page.locator('body').innerHTML());throw error})
  assert.equal(await editor.locator('strong').textContent(),'formatting')
  await editor.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type('Fresh text');await page.getByRole('button',{name:'Bold',exact:true}).click();await page.keyboard.type(' bold');assert.match(await page.evaluate(()=>window.testState.html),/<strong> bold<\/strong>/)
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.doesNotMatch(await page.evaluate(()=>window.testState.html),/ bold/)
  await page.getByRole('button',{name:'Redo',exact:true}).click();assert.match(await page.evaluate(()=>window.testState.html),/ bold/)
  await editor.click();await page.keyboard.press('ControlOrMeta+a');await page.getByLabel('Text style',{exact:true}).selectOption('2');assert.equal(await editor.locator('h2').count(),1);await page.waitForFunction(()=>document.getElementById('test-editor-format').value==='2')
  await page.getByRole('button',{name:'Edit link',exact:true}).click();await page.getByLabel('Link address',{exact:true}).fill('javascript:alert(1)');await page.getByRole('button',{name:'Apply',exact:true}).click();assert.match(await page.getByRole('alert').textContent(),/https/)
  await page.getByLabel('Link address',{exact:true}).fill('https://halobox.tv');await page.getByRole('button',{name:'Apply',exact:true}).click();assert.match(await page.evaluate(()=>window.testState.html),/href="https:\/\/halobox.tv"/)
  await page.getByRole('button',{name:'Choose image',exact:true}).click();await page.getByRole('tab',{name:'Current',exact:true}).waitFor();assert.equal(await page.getByRole('img',{name:'Current image',exact:true}).getAttribute('src'),'https://halobox.tv/media/current.avif')
  await page.getByRole('tab',{name:'Media Library',exact:true}).click();await page.getByRole('button',{name:/first.avif/}).waitFor();assert.equal(queries.at(-1).kind,'image')
  await page.getByRole('searchbox').fill('second');await page.getByRole('searchbox').press('Enter');await page.getByRole('button',{name:/second.avif/}).waitFor();await page.getByRole('button',{name:/first.avif/}).waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.submits||0),0,'search must not submit the surrounding edit form')
  await page.getByRole('button',{name:/second.avif/}).click();await page.getByRole('button',{name:'Use selected',exact:true}).click();assert.equal(await page.evaluate(()=>window.testState.value),'/media/second.avif')
  await page.getByRole('button',{name:'Choose image',exact:true}).click();await page.getByRole('tab',{name:'Current',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Media Library',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.testState.value),'/media/second.avif')
  await page.getByRole('button',{name:'Choose image',exact:true}).click();await page.getByRole('tab',{name:'Upload',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'test.avif',mimeType:'image/avif',buffer:imageBytes});await page.getByRole('button',{name:'Upload file',exact:true}).click();await page.getByRole('alert').filter({hasText:'Storage temporarily unavailable.'}).waitFor();assert.equal(await page.evaluate(()=>window.testState.value),'/media/second.avif');await page.getByRole('button',{name:'Upload file',exact:true}).click();await page.waitForFunction(()=>window.testState.value==='/media/uploaded.avif')
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Choose image',exact:true}).click();await page.getByRole('tab',{name:'Media Library',exact:true}).click();await page.getByRole('button',{name:/first.avif/}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile should not overflow horizontally');assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true)
  await page.screenshot({path:'/tmp/halobox-nov09/media-picker-mobile.png'});await page.keyboard.press('Escape');await page.screenshot({path:'/tmp/halobox-nov09/rich-editor-mobile.png'})
  assert.deepEqual(errors,[])
  console.log('RICH_MEDIA_BROWSER_OK: existing HTML, bold/undo/redo/headings/links, current artwork, real picker state, search without parent submit, library choose, keyboard tabs/cancel, failed upload retry, mobile layout; fixture server only')
} finally { await browser?.close(); if(server)await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true}) }
