import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fails = []
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
  if (/tmdb/i.test(src)) fails.push(`${f} still references TMDB`)
}
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('tmdb ok')
