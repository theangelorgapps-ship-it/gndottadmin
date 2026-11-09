// Live smoke check of /admin/bulk-upload on the 7400 dev server.
// Signs in with the local fixture admin, loads the page, exercises template download,
// sheet upload, auto-mapping and preview — but never clicks Import (real Bunny is live).
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const XLSX = require('xlsx')

const BASE = process.env.BULK_BASE || 'http://127.0.0.1:7400'
const GUID = '0443f5a5-de41-4536-b212-b15272a3cf86'

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto(`${BASE}/login`)
  const signedIn = await page.evaluate(async () => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'admin.local@halobox.test', password: 'LocalTest!2026' }),
    })
    return res.ok
  })
  assert.ok(signedIn, 'local fixture admin sign-in')

  await page.goto(`${BASE}/admin/bulk-upload`)
  await page.getByText('Upload spreadsheet').waitFor()
  await page.locator('a[href="/admin/bulk-upload"]').first().waitFor({ state: 'attached' })
  console.log('LIVE_PAGE_OK: bulk upload page loads with sidebar nav entry')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download template' }).click(),
  ])
  assert.equal(download.suggestedFilename(), 'halobox-bulk-upload-template.xlsx')
  console.log('LIVE_TEMPLATE_OK: template download works on the live page')

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Title', 'Destination', 'Video', 'Categories', 'Preacher', 'Location'],
    ['Live Smoke Clip', 'video', GUID, '', '', ''],
    ['', 'video', GUID, '', '', ''],
  ]), 'Bulk Upload')
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
  await page.locator('input[aria-label="Choose spreadsheet to import"]').setInputFiles({
    name: 'live-smoke.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer,
  })
  await page.getByText('1 ready · 1 with errors').waitFor()
  assert.equal(await page.locator('#bulk-map-2').inputValue(), 'video')
  await page.getByRole('button', { name: 'Import 1 row' }).waitFor()
  console.log('LIVE_PREVIEW_OK: sheet parsed, auto-mapped, preview rendered (import NOT clicked)')

  assert.deepEqual(errors, [])
  console.log('LIVE_BULK_SMOKE_OK')
} finally {
  await browser.close()
}
