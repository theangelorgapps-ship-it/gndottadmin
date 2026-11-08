import { execFileSync } from 'node:child_process'

// Baseline recorded before this work began (npx tsc --noEmit, exit 2).
// file:errorCode multiset of pre-existing errors that must not grow.
const baseline = [
  'src/lib/admin.ts:TS2307',
  'src/lib/db.ts:TS2307',
  'src/routes/api/upload.ts:TS2307',
  'src/routes/media/$.ts:TS2307',
  'src/routes/index.tsx:TS2345',
  'src/routes/admin/index.tsx:TS2322',
  'src/routes/admin/index.tsx:TS2322',
]

let out = ''
try {
  execFileSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (e) {
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`
}

const current = []
for (const line of out.split('\n')) {
  const m = line.match(/^(src\/[^\s(]+)\(\d+,\d+\): error (TS\d+)/)
  if (m) current.push(`${m[1]}:${m[2]}`)
}

const pool = [...baseline]
const fresh = []
for (const err of current) {
  const idx = pool.indexOf(err)
  if (idx >= 0) pool.splice(idx, 1)
  else fresh.push(err)
}
if (fresh.length) {
  console.error(`new type errors beyond baseline:\n${fresh.join('\n')}`)
  process.exit(1)
}
console.log(`typecheck ok (${current.length} baseline errors, 0 new)`)
