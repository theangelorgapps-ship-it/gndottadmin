import { readFileSync } from 'node:fs'

const fails = []
const admin = readFileSync('src/routes/admin.tsx', 'utf8')
for (const label of ['Sermons', 'Shows', 'Teaching', 'Personalities']) {
  if (!admin.includes(`'${label}'`)) fails.push(`sidebar missing label: ${label}`)
}
for (const gone of ['Movies', 'TV Shows', 'Cast & Crew', 'Seasons', 'Reviews']) {
  if (admin.includes(`'${gone}'`)) fails.push(`sidebar still has label: ${gone}`)
}
if (admin.includes('/admin/seasons') || admin.includes('/admin/reviews')) fails.push('sidebar still links seasons/reviews')
if (!admin.includes('/admin/teaching')) fails.push('sidebar missing /admin/teaching')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('rebrand admin ok')
