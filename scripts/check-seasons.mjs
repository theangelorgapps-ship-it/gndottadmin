import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fails = []
if (existsSync('src/routes/admin/seasons.tsx')) fails.push('seasons.tsx still exists')
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}
for (const f of walk('src')) {
  if (f === 'src/routeTree.gen.ts') continue
  const src = readFileSync(f, 'utf8')
  if (src.includes('/admin/seasons')) fails.push(`${f} references /admin/seasons`)
}
const ep = readFileSync('src/routes/admin/episodes.tsx', 'utf8')
if (ep.includes('season_id') || ep.includes('Season')) fails.push('episodes form still references seasons')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('seasons ok')
