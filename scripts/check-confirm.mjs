import { readFileSync, readdirSync, statSync } from 'node:fs'

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}

const fails = []
const confirmHits = []
for (const f of walk('src')) {
  if (f === 'src/lib/confirm.tsx') continue
  const src = readFileSync(f, 'utf8')
  src.split('\n').forEach((line, i) => {
    if (/[^.\w]confirm\(/.test(line)) confirmHits.push(`${f}:${i + 1}`)
  })
}
if (confirmHits.length) fails.push(`confirm() still present:\n${confirmHits.join('\n')}`)
const confirmSrc = readFileSync('src/lib/confirm.tsx', 'utf8')
if (!confirmSrc.includes('approval-card')) fails.push('confirm.tsx not backed by ApprovalCard')
if (!confirmSrc.includes('useConfirm')) fails.push('confirm.tsx missing useConfirm export')
const admin = readFileSync('src/routes/admin.tsx', 'utf8')
if (!admin.includes('ConfirmProvider')) fails.push('admin.tsx does not mount ConfirmProvider')
const crud = readFileSync('src/components/CrudTable.tsx', 'utf8')
if (!crud.includes('useConfirm')) fails.push('CrudTable not wired to useConfirm')
const genres = readFileSync('src/routes/admin/genres.tsx', 'utf8')
if (!genres.includes('useConfirm')) fails.push('genres.tsx not wired to useConfirm')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('confirm ok')
