// Real TanStack navigation and the production shell, isolated from account/data services.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-shell-'))
let server, browser
try {
  await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {createRootRoute,createRoute,createRouter,RouterProvider,Outlet,Link} from '@tanstack/react-router';
    import {LayoutDashboard,Users,Settings,MessagesSquare} from 'lucide-react';
    import {SidebarWithTabs} from './src/components/ui/sidebar-with-chrome-like-tabs';
    import {AdminBrand} from './src/components/AdminBrand';
    import './src/admin-polish.css'; import './src/admin-shell.css';
    const groups=[{title:'Workspace',items:[{to:'/admin',label:'Dashboard',icon:<LayoutDashboard/>},{to:'/admin/users',label:'Users',icon:<Users/>},{to:'/admin/settings',label:'Settings',icon:<Settings/>}]}];
    const initial=new URLSearchParams(location.search);const moderator=initial.get('role')==='moderator';const storageKey='halobox:tabs:'+(initial.get('account')||'test-account');
    const allowedGroups=moderator?[{title:'Moderation',items:[{to:'/admin/live-comments',label:'Live Comments',icon:<MessagesSquare/>}]}]:groups;
    const root=createRootRoute({component:()=> <SidebarWithTabs groups={allowedGroups} storageKey={storageKey} brand={<AdminBrand homeHref={moderator?'/admin/live-comments':'/admin'}/>} account={<span>Local Admin</span>}><Outlet/></SidebarWithTabs>});
    const routes=[createRoute({getParentRoute:()=>root,path:'/admin',component:()=> <h1>Dashboard overview</h1>}),
      createRoute({getParentRoute:()=>root,path:'/admin/users',component:()=> <><h1>Users directory</h1><Link to='/admin/user/$id' params={{id:'2'}}>View user 2</Link></>}),
      createRoute({getParentRoute:()=>root,path:'/admin/user/$id',component:()=> <h1>User detail</h1>}),
      createRoute({getParentRoute:()=>root,path:'/admin/settings',validateSearch:s=>({section:s.section}),component:()=> <><h1>Settings page</h1><Link to='/admin/settings' search={{section:'sign-in'}} hash='account'>Sign-in options</Link></>}),
      createRoute({getParentRoute:()=>root,path:'/admin/live-comments',component:()=> <h1>Live comments moderation</h1>})];
    const router=createRouter({routeTree:root.addChildren(routes)});createRoot(document.getElementById('app')).render(<RouterProvider router={router}/>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outdir: temporary, platform: 'browser', format: 'esm', jsx: 'automatic' })
  server = createServer((request, response) => {
    if (request.url === '/stdin.js' || request.url === '/stdin.css') {
      response.setHeader('content-type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css')
      response.end(readFileSync(path.join(temporary, request.url))); return
    }
    if (request.url === '/base.css') {
      response.setHeader('content-type', 'text/css')
      response.end(readFileSync('src/styles.css', 'utf8').replace('@import "tailwindcss";', '')); return
    }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/stdin.css"><style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="app"></div><script type="module" src="/stdin.js"></script></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(5000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const base = `http://127.0.0.1:${server.address().port}`
  await page.goto(base + '/admin')
  await page.getByRole('tab', { name: 'Dashboard', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Dashboard', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('button', { name: 'Open a new tab', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Users', exact: true }).click()
  await page.getByRole('heading', { name: 'Users directory', exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/admin/users')
  assert.equal(await page.getByRole('tab').count(), 2)
  await page.getByRole('tab', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('heading', { name: 'Dashboard overview', exact: true }).waitFor()
  await page.goBack()
  await page.getByRole('heading', { name: 'Users directory', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Users', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('link', { name: 'View user 2', exact: true }).click()
  await page.getByRole('heading', { name: 'User detail', exact: true }).waitFor()
  await page.reload()
  await page.getByRole('tab', { name: 'User details', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').count(), 2, 'Reload preserves the other open page')
  await page.getByRole('button', { name: 'Close User details tab', exact: true }).click()
  await page.getByRole('heading', { name: 'Dashboard overview', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Close Dashboard tab', exact: true }).isDisabled(), true)
  for (const name of ['Users', 'Settings']) {
    await page.getByRole('button', { name: 'Open a new tab', exact: true }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  await page.getByRole('tab', { name: 'Settings', exact: true }).focus()
  await page.keyboard.press('Alt+ArrowLeft')
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Dashboard', 'Settings', 'Users'], 'Keyboard reorders the selected tab')
  await page.reload()
  await page.getByRole('tab', { name: 'Settings', exact: true }).waitFor()
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Dashboard', 'Settings', 'Users'], 'Tab order persists')
  const handle = await page.getByRole('button', { name: 'Drag Settings tab to reorder', exact: true }).boundingBox()
  const firstTab = await page.getByRole('tab', { name: 'Dashboard', exact: true }).boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(firstTab.x, firstTab.y + firstTab.height / 2, { steps: 15 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector('[role="tab"]')?.textContent === 'Settings')
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Settings', 'Dashboard', 'Users'], 'Pointer drag reorders tabs')
  await page.getByRole('button', { name: 'Tab actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Move tab right', exact: true }).click()
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Dashboard', 'Settings', 'Users'], 'Touch-friendly menu reorders tabs')
  await page.getByRole('button', { name: 'Tab actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Close tabs to the right', exact: true }).click()
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Dashboard', 'Settings'])
  await page.getByRole('link', { name: 'Sign-in options', exact: true }).click()
  await page.waitForURL(/section=sign-in.*#account$/)
  await page.getByRole('tab', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  assert.equal(new URL(page.url()).searchParams.get('section'), 'sign-in', 'Tabs retain route search state')
  assert.equal(new URL(page.url()).hash, '#account')
  await page.reload()
  await page.getByRole('tab', { name: 'Settings', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Dashboard')
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'Dashboard overview', exact: true }).waitFor()
  await page.keyboard.press('End')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Settings')
  await page.keyboard.press('Delete')
  assert.equal(await page.getByRole('tab').count(), 1)
  await page.waitForFunction(() => document.activeElement?.textContent === 'Dashboard')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Dashboard')
  await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.sidebar-desktop').getBoundingClientRect().width >= 263)
  const outputDir = process.env.ADMIN_SHELL_SCREENSHOTS || '/tmp/halobox-nov09-followup/admin-shell-evidence'
  mkdirSync(outputDir, { recursive: true })
  await page.screenshot({ path: path.join(outputDir, 'desktop.png'), fullPage: false })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Admin navigation', exact: true })
    await drawer.waitFor()
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true, 'Drawer contains keyboard focus')
    await page.screenshot({ path: path.join(outputDir, `mobile-drawer-${width}.png`), fullPage: false })
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('button', { name: 'Open navigation', exact: true }).evaluate(element => element === document.activeElement), true)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await drawer.getByRole('link', { name: 'Users', exact: true }).click()
    await page.getByRole('heading', { name: 'Users directory', exact: true }).waitFor()
    assert.equal(await drawer.isVisible(), false)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal page overflow at ${width}px`)
    await page.screenshot({ path: path.join(outputDir, `mobile-${width}.png`), fullPage: false })
  }
  await page.getByRole('button', { name: 'Open a new tab', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click()
  await page.goto(base + '/admin?account=second-account')
  await page.getByRole('tab', { name: 'Dashboard', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').count(), 1, 'Another account does not inherit open tabs')
  await page.goto(base + '/admin/live-comments?role=moderator')
  await page.getByRole('tab', { name: 'Live Comments', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').count(), 1, 'Restored tabs outside current permissions are discarded')
  await page.getByRole('button', { name: 'Open a new tab', exact: true }).click()
  assert.deepEqual(await page.getByRole('menuitem').allTextContents(), ['Live Comments'])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  assert.equal(await page.getByRole('dialog').getByRole('link', { name: 'GoodNews Halobox live comments', exact: true }).getAttribute('href'), '/admin/live-comments')
  await page.keyboard.press('Escape')
  await page.evaluate(() => localStorage.setItem('halobox:tabs:test-account', '{broken JSON'))
  await page.goto(base + '/admin')
  await page.getByRole('tab', { name: 'Dashboard', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').count(), 1, 'Corrupt storage recovers')
  await page.evaluate(() => localStorage.setItem('halobox:tabs:test-account', JSON.stringify({version:1,activeId:'external',tabs:[{id:'external',href:'https://example.invalid'},{id:'script',href:'javascript:alert(1)'},{id:'other',href:'/login'}]})))
  await page.reload()
  await page.getByRole('tab', { name: 'Dashboard', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').count(), 1, 'Untrusted storage cannot open arbitrary destinations')
  const privatePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  privatePage.on('pageerror', error => errors.push(error.message))
  await privatePage.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Disabled', 'SecurityError') } }))
  await privatePage.goto(base + '/admin')
  await privatePage.getByRole('button', { name: 'Open a new tab', exact: true }).click()
  await privatePage.getByRole('menuitem', { name: 'Users', exact: true }).click()
  await privatePage.getByRole('heading', { name: 'Users directory', exact: true }).waitFor()
  await privatePage.close()
  assert.deepEqual(errors, [])
  console.log('ADMIN_SHELL_BROWSER_OK')
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
  rmSync(temporary, { recursive: true, force: true })
}
