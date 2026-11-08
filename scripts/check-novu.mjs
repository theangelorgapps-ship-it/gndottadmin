import { readFileSync, existsSync } from 'node:fs'

const fails = []
const s = readFileSync('src/routes/admin/settings.tsx', 'utf8')
const notifBlock = s.split("id: 'notification-config'")[1]?.split("id: 'currency'")[0] ?? ''
for (const f of ['novu_api_key', 'novu_application_id', 'novu_backend_url']) {
  if (!notifBlock.includes(f)) fails.push(`notification-config tab missing ${f}`)
}
if (notifBlock.includes('firebase') || notifBlock.includes('Firebase')) fails.push('Firebase fields still in notification-config tab')
if (!s.includes('adminTestNovu')) fails.push('settings not wired to adminTestNovu')
if (!existsSync('src/lib/novu.ts')) fails.push('src/lib/novu.ts missing')
const lib = readFileSync('src/lib/admin.ts', 'utf8')
if (!lib.includes('adminTestNovu')) fails.push('admin.ts missing adminTestNovu server fn')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('novu ok')
