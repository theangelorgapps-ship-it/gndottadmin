import { readFileSync, readdirSync, statSync } from 'node:fs'

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}

const fails = []
const alertHits = []
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8')
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    if (/[^.\w]alert\(/.test(line)) alertHits.push(`${f}:${i + 1}`)
  })
}
if (alertHits.length) fails.push(`alert() still present:\n${alertHits.join('\n')}`)
if (!readFileSync('src/lib/toast.tsx', 'utf8').includes('useToast')) fails.push('src/lib/toast.tsx missing useToast export')
if (!readFileSync('src/lib/toast.tsx', 'utf8').includes('halo-notification')) fails.push('toast.tsx not backed by halo-notification')
const admin = readFileSync('src/routes/admin.tsx', 'utf8')
if (!admin.includes('ToastProvider')) fails.push('admin.tsx does not mount ToastProvider')
let notifyCount = 0
for (const f of walk('src')) notifyCount += (readFileSync(f, 'utf8').match(/notify\(/g) || []).length
if (notifyCount < 5) fails.push(`only ${notifyCount} notify( call sites; expected at least 5 across admin mutations`)
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('toasts ok')
