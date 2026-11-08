import { readFileSync } from 'node:fs'

const fails = []
const users = readFileSync('src/routes/admin/users.tsx', 'utf8')
if (!users.includes('ml-row')) fails.push('users.tsx does not render member-list style rows (ml-row)')
if (!users.includes('ml-avatar')) fails.push('users.tsx missing ml-avatar cells')
const css = readFileSync('src/styles.css', 'utf8')
if (!css.includes('.ml-row')) fails.push('styles.css missing .ml-row member-list styles')
if (!/\.admin-table\s+thead\s+th\s*\{[^}]*position:\s*sticky/.test(css)) fails.push('admin-table header not sticky')
if (!/\.admin-table\s+tbody\s+tr:hover/.test(css)) fails.push('admin-table rows missing hover style')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('lists ok')
