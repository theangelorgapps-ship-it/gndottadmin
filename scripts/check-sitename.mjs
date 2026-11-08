import { readFileSync } from 'node:fs'

const fails = []
const src = readFileSync('src/routes/admin/settings.tsx', 'utf8')

const customBlock = src.split("id: 'customization'")[1]?.split("id: 'mail'")[0] ?? ''
if (!customBlock.includes("name: 'app_name'")) fails.push('customization tab has no app_name (Site Name) field')
if (!src.includes('useToast')) fails.push('settings save does not notify via toast')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('sitename ok')
