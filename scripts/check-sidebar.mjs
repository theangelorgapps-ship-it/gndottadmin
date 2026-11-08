import { readFileSync } from 'node:fs'

const fails = []
const admin = readFileSync('src/routes/admin.tsx', 'utf8')
for (const needle of ['components/ui/sidebar', 'SidebarBody', 'SidebarLink', 'ToastProvider', 'ConfirmProvider']) {
  if (!admin.includes(needle)) fails.push(`admin.tsx missing: ${needle}`)
}
if (admin.includes('admin-side')) fails.push('admin.tsx still renders the old static .admin-side aside')
for (const label of ['Genres', 'Movies', 'TV Shows', 'Subscriptions', 'Access Control', 'Notification Templates']) {
  if (!admin.includes(`'${label}'`) && !admin.includes(`"${label}"`)) fails.push(`admin.tsx nav lost label: ${label}`)
}
const css = readFileSync('src/styles.css', 'utf8')
if (!/\.admin-shell\s*\{[^}]*display:\s*flex/.test(css)) fails.push('styles.css .admin-shell not switched to flex')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('sidebar ok')
