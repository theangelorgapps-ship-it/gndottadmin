import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const G = '../gndott'
const fails = []
const root = readFileSync(join(G, 'src/routes/__root.tsx'), 'utf8')
for (const label of ['Sermons', 'Shows', 'Teaching']) {
  if (!root.includes(`>${label}<`)) fails.push(`public nav missing: ${label}`)
}
if (root.includes('>Movies<') || root.includes('>TV Shows<')) fails.push('public nav still shows Movies/TV Shows')
if (!existsSync(join(G, 'src/routes/teaching.tsx'))) fails.push('public /teaching route missing')
if (existsSync(join(G, 'src/routes/teaching.tsx'))) {
  const t = readFileSync(join(G, 'src/routes/teaching.tsx'), 'utf8')
  if (!t.includes('teaching')) fails.push('teaching route does not filter teaching content')
}
const castPage = readFileSync(join(G, 'src/routes/cast.tsx'), 'utf8')
if (!/Personalit/i.test(castPage)) fails.push('public cast page not labeled Personalities')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('rebrand public ok')
