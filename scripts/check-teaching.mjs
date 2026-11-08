import { readFileSync, existsSync } from 'node:fs'

const fails = []
if (!existsSync('src/routes/admin/teaching.tsx')) fails.push('src/routes/admin/teaching.tsx missing')
if (!existsSync('src/routes/admin/teaching-episodes.tsx')) fails.push('src/routes/admin/teaching-episodes.tsx missing')
const lib = readFileSync('src/lib/admin.ts', 'utf8')
if (!lib.includes("'teaching'")) fails.push('admin.ts does not accept teaching type')
if (!lib.includes('teaching-episodes')) fails.push('admin.ts missing teaching-episodes query')
const cc = readFileSync('src/components/admin-content.tsx', 'utf8')
if (!cc.includes('teaching')) fails.push('admin-content does not handle teaching type')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('teaching ok')
