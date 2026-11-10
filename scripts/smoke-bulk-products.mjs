// Focused smoke test for the products column in bulk upload:
// header auto-mapping, row parsing, revalidation, and import wiring.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const dir = mkdtempSync(path.join(tmpdir(), 'halobox-bulk-products-'))
const outfile = path.join(dir, 'bundle.mjs')
await build({
  entryPoints: ['src/lib/bulk-import-core.ts'],
  bundle: true, format: 'esm', outfile, platform: 'node',
  external: [],
})
const core = await import(outfile)
const { autoMapHeaders, parseBulkRows, revalidateBulkRows, importBulkRows } = core

// 1. Auto-mapping recognises a Products column.
const headers = ['Title', 'Destination', 'Video', 'Products']
const mapping = autoMapHeaders(headers)
assert.deepEqual(mapping, ['title', 'destination', 'video', 'products'])

// 2. Parsing extracts safe product IDs and warns on junk.
const matrix = [
  ['Easter Sunday', 'Sermon', 'https://www.dropbox.com/s/abc/e.mp4?dl=0', '32371; 33532, junk'],
]
const [row] = parseBulkRows(matrix, mapping)
assert.deepEqual(row.productIds, [32371, 33532])
assert.equal(row.warnings.some(w => w.includes('junk')), true)
assert.equal(row.errors.length, 0)

// 3. Revalidation re-derives IDs from untrusted client data.
const [revalidated] = revalidateBulkRows([{ ...row, productIds: ['32371', -5, 999999999999999999, 7] }])
assert.deepEqual(revalidated.productIds, [32371, 7])

// 4. Import passes product IDs through to the store mapping.
const mapped = []
const store = {
  async insertJob() { return 1 },
  async updateJob() {},
  async getJob(id) { return { id } },
  async listJobs() { return [] },
  async activeJobs() { return [] },
  async claimedVideoIds() { return [] },
  async insertContent() { return 42 },
  async attachContentGuid() {},
  async softDeleteContent() {},
  async mapContent(table, id, maps) { mapped.push({ table, id, maps }) },
}
const tax = {
  async resolve(kind, name) { return { id: 9, created: true } },
  async contentNameExists() { return false },
}
const bunny = {
  async fetchVideo() { return { ok: true } },
  async listVideos() { return [] },
  async getVideo() { return { status: 3 } },
  async deleteVideo() {},
}
const results = await importBulkRows(revalidateBulkRows([{ ...row, productIds: [32371, 33532] }]), { tax, store, bunny })
assert.equal(results[0].outcome, 'queued')
const contentMap = mapped.find(m => m.id === 42)
assert.ok(contentMap, 'expected mapContent for the new content row')
assert.deepEqual(contentMap.maps.productIds, [32371, 33532])

console.log('BULK_PRODUCTS_OK')
writeFileSync(path.join(dir, 'done'), 'ok')
