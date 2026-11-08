import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const GNDOTT = '../gndott'
const fails = []

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}

let libHasAppName = false
for (const f of walk(join(GNDOTT, 'src/lib'))) {
  if (readFileSync(f, 'utf8').includes('app_name')) libHasAppName = true
}
if (!libHasAppName) fails.push('gndott src/lib has no app_name reader')

const root = readFileSync(join(GNDOTT, 'src/routes/__root.tsx'), 'utf8')
if (!root.includes('app_name') && !root.includes('siteName') && !root.includes('site.name')) {
  fails.push('gndott __root.tsx does not use the loaded site name')
}
if (!/loader\s*:/.test(root)) fails.push('gndott __root.tsx has no loader for site info')

if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('public sitename ok')
