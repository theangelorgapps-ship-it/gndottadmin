import { readFileSync, existsSync } from 'node:fs'

const fails = []
const card = 'src/components/ui/course-design-cards.tsx'
if (!existsSync(card)) fails.push('course-design-cards.tsx missing')
else {
  const src = readFileSync(card, 'utf8')
  for (const n of ['CardData', 'progressPercent', 'countdownText']) {
    if (!src.includes(n)) fails.push(`course-design-cards.tsx missing: ${n}`)
  }
}
const css = readFileSync('src/styles.css', 'utf8')
for (const n of ['.cc-card', '.cc-progress-bar', '--clr-green', '--clr-orange']) {
  if (!css.includes(n)) fails.push(`styles.css missing: ${n}`)
}
const dash = readFileSync('src/routes/admin/index.tsx', 'utf8')
if (!dash.includes('cc-card')) fails.push('dashboard stat cards not using course-card design')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('cards ok')
