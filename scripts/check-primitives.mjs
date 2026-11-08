import { readFileSync, existsSync } from 'node:fs'

const files = [
  'avatar', 'badge', 'button', 'card', 'checkbox', 'dropdown-menu',
  'input', 'textarea', 'input-group', 'separator', 'tooltip', 'popover',
  'label', 'button-group', 'table', 'progress',
]
const fails = []
for (const f of files) {
  const p = `src/components/ui/${f}.tsx`
  if (!existsSync(p)) fails.push(`${p} missing`)
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const all = { ...pkg.dependencies, ...pkg.devDependencies }
for (const d of ['@radix-ui/react-slot', '@radix-ui/react-checkbox', '@radix-ui/react-dropdown-menu', '@radix-ui/react-separator', '@radix-ui/react-popover', '@radix-ui/react-label', '@radix-ui/react-progress']) {
  if (!all[d]) fails.push(`${d} not in package.json`)
  else if (!existsSync(`node_modules/${d}/package.json`)) fails.push(`${d} not installed`)
}
const css = readFileSync('src/styles.css', 'utf8')
for (const token of ['--color-popover', '--radius:']) {
  if (!css.includes(token)) fails.push(`styles.css missing token ${token}`)
}
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('primitives ok')
