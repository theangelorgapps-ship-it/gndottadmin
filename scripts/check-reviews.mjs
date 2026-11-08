import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fails = []
if (existsSync('src/routes/admin/reviews.tsx')) fails.push('reviews.tsx still exists')
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}
for (const f of walk('src')) {
  if (f === 'src/routeTree.gen.ts' || f === 'src/lib/admin.ts') continue
  const src = readFileSync(f, 'utf8')
  if (src.includes('/admin/reviews')) fails.push(`${f} references /admin/reviews`)
}
const dash = readFileSync('src/routes/admin/index.tsx', 'utf8')
if (dash.includes('Total Reviews')) fails.push('dashboard still has Total Reviews card')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('reviews ok')
