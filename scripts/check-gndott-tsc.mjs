import { execFileSync } from 'node:child_process'

const baseline = [
  'src/lib/db.ts:TS2307',
  'src/routes/media/$.ts:TS2307',
  'src/routes/__root.tsx:TS2741',
]

let out = ''
try {
  execFileSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', cwd: '../gndott', stdio: ['ignore', 'pipe', 'pipe'] })
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
  console.error(`gndott new type errors beyond baseline:\n${fresh.join('\n')}`)
  process.exit(1)
}
console.log('typechecks ok')
