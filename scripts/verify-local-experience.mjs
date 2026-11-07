import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const workspace = dirname(root)
const cli = '/Users/charlesfinney/.codex/skills/playwright/scripts/playwright_cli.sh'
const outputDir = join(root, 'output/playwright')
const screenshotDir = join(outputDir, 'admin-routes')
const stateDir = join(root, '.tmp/admin-local-state')
const reportPath = join(outputDir, 'admin-experience-report.json')
const uploadPath = join(outputDir, 'local-acceptance.png')
const base = 'http://localhost:5202'
const session = 'admin-acceptance'
const routes = [
  '/admin', '/admin/media-library', '/admin/genres', '/admin/movies', '/admin/tv-shows',
  '/admin/series', '/admin/episodes', '/admin/teaching', '/admin/teaching-volumes',
  '/admin/teaching-episodes', '/admin/videos', '/admin/tv-category', '/admin/live-tv',
  '/admin/actors', '/admin/directors', '/admin/vast-ads', '/admin/custom-ads',
  '/admin/subscriptions', '/admin/plans', '/admin/plan-limits', '/admin/rent-history',
  '/admin/coupons', '/admin/users', '/admin/soon-to-expire', '/admin/banners',
  '/admin/constants', '/admin/notification-templates', '/admin/settings', '/admin/pages',
  '/admin/onboarding', '/admin/tax', '/admin/faq', '/admin/language', '/admin/world',
  '/admin/currency', '/admin/countries', '/admin/access-control', '/admin/user/2',
]
const expectedSettingsTabs = [
  'Business Settings', 'Custom Code', 'Module Settings', 'Misc Settings', 'Customization',
  'Mail Settings', 'Notification Settings', 'Payment Methods', 'Language Settings',
  'Notification Configuration', 'Currency Settings', 'Storage Settings', 'Bunny Stream', 'SEO Settings',
]

mkdirSync(screenshotDir, { recursive: true })
writeFileSync(uploadPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeout ?? 120000,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed\n${output}${result.error ? `\n${result.error.message}` : ''}`)
  return output
}

function browser(command, args = [], allowFailure = false) {
  const result = spawnSync(cli, [`-s=${session}`, command, ...args], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240000,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`Browser ${command} failed\n${output}${result.error ? `\n${result.error.message}` : ''}`)
  }
  return output
}

async function waitForServer(child) {
  let serverOutput = ''
  child.stdout.on('data', (chunk) => { serverOutput += chunk })
  child.stderr.on('data', (chunk) => { serverOutput += chunk })
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Development server exited early\n${serverOutput}`)
    try {
      const response = await fetch(`${base}/login`, { redirect: 'manual' })
      if (response.status < 500) return
    } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Development server did not become ready\n${serverOutput}`)
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return
  try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ])
  if (child.exitCode === null) {
    try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
  }
}

const browserCode = `async (page) => {
  const base = ${JSON.stringify(base)}
  const screenshotDir = ${JSON.stringify(screenshotDir)}
  const uploadPath = ${JSON.stringify(uploadPath)}
  const routes = ${JSON.stringify(routes)}
  const expectedSettingsTabs = ${JSON.stringify(expectedSettingsTabs)}
  const failures = []
  const measurements = []
  const workflows = []
  const pageErrors = []
  const forbidden = /\\b(?:streamit|imdb|reviews?|ratings?|stars?|movies?|tv[\\s_-]*shows?|actors?|directors?|cast)\\b|[★☆]/i
  const check = (condition, message) => { if (!condition) failures.push(message) }
  const slug = (route) => route === '/admin' ? 'dashboard' : route.slice(6).replaceAll('/', '-')
  page.setDefaultTimeout(20000)
  page.on('pageerror', (error) => pageErrors.push(error.message))

  async function goto(route) {
    const consoleErrors = []
    const listener = (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) }
    page.on('console', listener)
    const response = await page.goto(base + route, { waitUntil: 'networkidle' })
    await page.locator('#main-content').waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(120)
    page.off('console', listener)
    check(response && response.status() < 400, route + ' returned HTTP ' + (response ? response.status() : 'none'))
    check(new URL(page.url()).pathname === route, route + ' redirected unexpectedly to ' + page.url())
    check(consoleErrors.length === 0, route + ' console errors: ' + consoleErrors.join(' | '))
    const text = await page.locator('body').innerText()
    check(text.includes('GoodNews Halobox'), route + ' is missing current branding')
    const legacy = text.match(forbidden)
    check(!legacy, route + ' contains forbidden visible vocabulary: ' + (legacy ? legacy[0] : ''))
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      title: document.title,
    }))
    check(dimensions.documentWidth <= dimensions.viewport + 1 && dimensions.bodyWidth <= dimensions.viewport + 1,
      route + ' has page-level horizontal overflow: ' + JSON.stringify(dimensions))
    const record = { route, viewport: dimensions.viewport, ...dimensions }
    measurements.push(record)
    await page.screenshot({ path: screenshotDir + '/' + dimensions.viewport + '-' + slug(route) + '.png', fullPage: false })
  }

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  await page.goto(base + '/login', { waitUntil: 'networkidle' })
  await page.getByLabel('Email address').fill('admin.local@halobox.test')
  await page.getByLabel('Password', { exact: true }).fill('LocalTest!2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(base + '/admin', { timeout: 20000 }).catch(() => {})
  if (!page.url().startsWith(base + '/admin')) {
    const loginText = await page.locator('body').innerText()
    await page.screenshot({ path: screenshotDir + '/login-failure.png', fullPage: true })
    throw new Error('Local login did not reach /admin; url=' + page.url() + '; body=' + loginText)
  }
  await page.locator('#main-content').waitFor({ state: 'visible' })
  workflows.push({ name: 'real local login', ok: true })

  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const route of routes) {
      try { await goto(route) } catch (error) { failures.push(route + ' at ' + viewport.name + ': ' + error.message) }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/admin', { waitUntil: 'networkidle' })
  const menuButton = page.getByRole('button', { name: 'Open navigation', exact: true })
  await menuButton.click()
  const mobileDialog = page.locator('#admin-mobile-navigation')
  await mobileDialog.waitFor({ state: 'visible' })
  check(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'Mobile navigation did not lock background scrolling')
  await page.keyboard.press('Escape')
  await mobileDialog.waitFor({ state: 'hidden' })
  check(await menuButton.evaluate((element) => element === document.activeElement), 'Mobile navigation did not return focus after Escape')
  await menuButton.click()
  await mobileDialog.getByRole('link', { name: 'Personalities', exact: true }).click()
  await page.waitForURL(base + '/admin/actors')
  check(!(await mobileDialog.isVisible()), 'Mobile navigation stayed open after destination selection')
  workflows.push({ name: 'mobile navigation, Escape, focus restoration, and routing', ok: true })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(base + '/admin/settings', { waitUntil: 'networkidle' })
  const tabs = page.getByRole('tab')
  check(await tabs.count() === 14, 'Expected 14 settings tabs, measured ' + await tabs.count())
  const actualTabs = await tabs.allTextContents()
  check(JSON.stringify(actualTabs) === JSON.stringify(expectedSettingsTabs), 'Settings tab inventory changed: ' + JSON.stringify(actualTabs))
  for (let index = 0; index < expectedSettingsTabs.length; index++) {
    const tab = tabs.nth(index)
    await tab.click()
    check(await tab.getAttribute('aria-selected') === 'true', 'Settings tab did not select: ' + expectedSettingsTabs[index])
    check(await page.getByRole('tabpanel').getAttribute('aria-labelledby') === await tab.getAttribute('id'), 'Settings panel association failed: ' + expectedSettingsTabs[index])
  }
  await tabs.nth(0).click()
  await tabs.nth(0).focus()
  await page.keyboard.press('ArrowRight')
  check(await tabs.nth(1).getAttribute('aria-selected') === 'true', 'Settings arrow-key navigation failed')
  workflows.push({ name: 'all 14 settings tabs and keyboard navigation', ok: true })

  await page.getByRole('tab', { name: 'Notification Configuration', exact: true }).click()
  await page.getByRole('button', { name: 'Test Novu Connection', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: /Novu|secret|key|required|configured/i }).first().waitFor({ state: 'visible' })
  workflows.push({ name: 'Novu missing-key error remains visible', ok: true })

  await page.getByRole('tab', { name: 'Bunny Stream', exact: true }).click()
  await page.getByLabel('Bunny Stream Library ID', { exact: true }).fill('local-acceptance-library')
  await page.getByRole('button', { name: 'Save Change', exact: true }).click()
  await page.getByText('Settings saved', { exact: true }).waitFor({ state: 'visible' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Bunny Stream', exact: true }).click()
  check(await page.getByLabel('Bunny Stream Library ID', { exact: true }).inputValue() === 'local-acceptance-library', 'Bunny setting did not persist locally')
  workflows.push({ name: 'Bunny settings save and reload', ok: true })

  await page.goto(base + '/admin/genres', { waitUntil: 'networkidle' })
  const newGenre = page.getByRole('button', { name: '+ New Genre', exact: true })
  await newGenre.click()
  const genreDialog = page.locator('dialog[open]')
  await genreDialog.waitFor({ state: 'visible' })
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'genre-name'), 'Genre dialog did not place initial focus')
  await page.keyboard.press('Escape')
  await genreDialog.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement && document.activeElement.textContent && document.activeElement.textContent.includes('+ New Genre'))
  check(await newGenre.evaluate((element) => element === document.activeElement), 'Genre dialog did not restore trigger focus')
  await newGenre.click()
  await page.locator('#genre-name').fill('Acceptance Genre')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Acceptance Genre', { exact: true }).first().waitFor({ state: 'visible' })
  workflows.push({ name: 'dialog focus, Escape, and local genre create', ok: true })

  const genreSearch = page.getByRole('searchbox', { name: 'Search genres…', exact: true })
  await genreSearch.fill('NO-SUCH-GENRE-ACCEPTANCE')
  await page.getByText('No matching records', { exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Clear search', exact: true }).last().click()
  check(await genreSearch.inputValue() === '', 'Filtered empty-state clear action did not reset search')
  workflows.push({ name: 'filtered empty state and clear search', ok: true })

  await page.getByRole('button', { name: 'Actions for Acceptance Genre', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit Acceptance Genre', exact: true }).click()
  await page.locator('#genre-name').fill('Acceptance Genre Updated')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Acceptance Genre Updated', { exact: true }).first().waitFor({ state: 'visible' })
  workflows.push({ name: 'local genre edit', ok: true })

  await page.getByRole('button', { name: 'Actions for Acceptance Genre Updated', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete Acceptance Genre Updated', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: /Delete genre/ })
  await confirmation.waitFor({ state: 'visible' })
  check(await page.getByRole('button', { name: 'Cancel', exact: true }).evaluate((element) => element === document.activeElement), 'Destructive confirmation did not initially focus Cancel')
  await page.keyboard.press('Escape')
  await confirmation.waitFor({ state: 'hidden' })
  check(await page.getByText('Acceptance Genre Updated', { exact: true }).first().isVisible(), 'Escape incorrectly approved deletion')
  await page.getByRole('button', { name: 'Actions for Acceptance Genre Updated', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete Acceptance Genre Updated', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByText('Acceptance Genre Updated', { exact: true }).first().waitFor({ state: 'hidden' })
  workflows.push({ name: 'safe destructive confirmation and local delete', ok: true })

  await page.goto(base + '/admin/episodes', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '+ Add Episode', exact: true }).click()
  const seriesSelect = page.locator('dialog[open] select[id$="-season_id"]')
  const showSelect = page.locator('dialog[open] select[id$="-entertainment_id"]')
  check(await seriesSelect.isDisabled(), 'Dependent Series selector should start disabled')
  await showSelect.selectOption({ label: 'Local Show' })
  check(await seriesSelect.isEnabled(), 'Series selector did not enable after choosing Show')
  await seriesSelect.selectOption({ label: 'Local Series' })
  check(await seriesSelect.inputValue() === '30', 'Series selector did not retain the matching option')
  await page.keyboard.press('Escape')
  workflows.push({ name: 'dependent Show and Series selectors', ok: true })

  await page.goto(base + '/admin/media-library', { waitUntil: 'networkidle' })
  await page.getByLabel('Choose files to upload', { exact: true }).setInputFiles(uploadPath)
  await page.getByText('local-acceptance.png', { exact: true }).first().waitFor({ state: 'visible' })
  await page.getByText('Completed', { exact: true }).waitFor({ state: 'visible' })
  await page.reload({ waitUntil: 'networkidle' })
  const mediaCard = page.locator('article').first()
  await mediaCard.waitFor({ state: 'visible' })
  check(await page.locator('article').count() === 1, 'Expected exactly one isolated uploaded media object')
  const mediaName = await mediaCard.getByRole('heading').innerText()
  check(mediaName.startsWith('uploads/') && mediaName.endsWith('.png'), 'Uploaded media object has an unexpected key: ' + mediaName)
  await mediaCard.getByRole('button', { name: 'Copy URL', exact: true }).click()
  await mediaCard.getByText('Copied', { exact: true }).waitFor({ state: 'visible' })
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  check(clipboard.includes('/media/uploads/') && clipboard.endsWith('.png'), 'Media copy URL did not contain the uploaded object URL: ' + clipboard)
  await mediaCard.getByRole('button', { name: 'Delete', exact: true }).click()
  const mediaConfirmation = page.locator('dialog[open]')
  await mediaConfirmation.getByRole('button', { name: 'Delete', exact: true }).click()
  await mediaCard.waitFor({ state: 'hidden' })
  workflows.push({ name: 'local R2 upload, copy, and delete', ok: true })

  check(pageErrors.length === 0, 'Browser page errors: ' + pageErrors.join(' | '))
  return { failures, measurements, workflows, pageErrors, routes: routes.length, viewports: 2 }
}`

let server
let createdDevVars = false
const devVarsPath = join(root, '.dev.vars')
let report = { failures: ['Verification did not complete'], measurements: [], workflows: [], routes: routes.length, viewports: 2 }
try {
  rmSync(stateDir, { recursive: true, force: true })
  mkdirSync(stateDir, { recursive: true })
  run('npx', ['wrangler', 'd1', 'execute', 'streamit', '--local', '--persist-to', stateDir, '--file', 'scripts/local-admin-fixture.sql'])
  try {
    writeFileSync(devVarsPath, 'SESSION_SECRET=local-admin-acceptance-only-2026-not-production\n', { flag: 'wx' })
    createdDevVars = true
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }

  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5202', '--strictPort'], {
    cwd: root,
    env: { ...process.env, ADMIN_LOCAL_STATE: stateDir, SESSION_SECRET: 'local-admin-acceptance-only-2026-not-production' },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForServer(server)
  browser('open', [`${base}/login`])
  const raw = browser('run-code', [browserCode, '--raw'])
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error(`Browser returned no report\n${raw}`)
  report = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
  writeFileSync(reportPath, JSON.stringify({ ...report, generatedAt: new Date().toISOString(), base, screenshotDir }, null, 2))
  if (!Array.isArray(report.failures) || report.failures.length > 0) {
    throw new Error(`Admin experience failures:\n${(report.failures ?? ['Invalid report']).join('\n')}`)
  }
  if (report.measurements.length !== routes.length * 2) throw new Error(`Expected ${routes.length * 2} route measurements, received ${report.measurements.length}`)
  console.log(`ADMIN_EXPERIENCE_OK routes=${routes.length} viewports=2`)
} catch (error) {
  writeFileSync(reportPath, JSON.stringify({ ...report, generatedAt: new Date().toISOString(), base, screenshotDir, fatal: error.message }, null, 2))
  console.error(error.message)
  process.exitCode = 1
} finally {
  browser('close', [], true)
  await stopServer(server)
  if (createdDevVars) rmSync(devVarsPath, { force: true })
}
