import { readFileSync } from 'node:fs'

const css = readFileSync('src/styles.css', 'utf8')
const fails = []

if (!css.includes('.table-scroll')) fails.push('styles.css missing .table-scroll')
if (!/\.table-scroll\s*\{[^}]*overflow-x:\s*auto/.test(css)) fails.push('.table-scroll lacks overflow-x: auto')
if (!/\.admin-main\s*\{[^}]*overflow-x:\s*clip/.test(css)) fails.push('.admin-main does not clip horizontal overflow')
if (!/\.date-bar\s*\{[^}]*flex-wrap/.test(css)) fails.push('.date-bar does not wrap')

const mobileBlocks = css.split('@media').slice(1).join('@media')
if (!/max-width:\s*560px\)[^@]*\.stat-grid\s*\{\s*grid-template-columns:\s*1fr/s.test(mobileBlocks)) {
  fails.push('stat-grid has no single-column small-screen rule')
}
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('responsive ok')
