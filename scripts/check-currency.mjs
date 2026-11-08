import { readFileSync } from 'node:fs'

const fails = []
const s = readFileSync('src/routes/admin/settings.tsx', 'utf8')
if (!s.includes('default_currency')) fails.push('settings missing default_currency field')
const lib = readFileSync('src/lib/admin.ts', 'utf8')
if (!lib.includes('adminUpsertSetting')) fails.push('admin.ts missing adminUpsertSetting')
if (!lib.includes('adminListCurrencies')) fails.push('admin.ts missing adminListCurrencies')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('currency ok')
