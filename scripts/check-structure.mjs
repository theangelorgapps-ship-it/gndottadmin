import { readFileSync, existsSync } from 'node:fs'

const fails = []
const tsconfig = readFileSync('tsconfig.json', 'utf8')
if (!tsconfig.includes('"@/*"')) fails.push('tsconfig missing @/* path alias')
const vite = readFileSync('vite.config.ts', 'utf8')
if (!/alias/.test(vite) || !vite.includes("'@'")) fails.push('vite.config missing @ alias')
if (!existsSync('src/lib/utils.ts')) fails.push('src/lib/utils.ts missing')
else if (!/export function cn/.test(readFileSync('src/lib/utils.ts', 'utf8'))) fails.push('utils.ts does not export cn')
const css = readFileSync('src/styles.css', 'utf8')
for (const needle of [
  'tailwindcss/theme.css',
  'tailwindcss/utilities.css',
  '@custom-variant dark',
  '@custom-variant fine-hover',
  'tw-animate-css',
  '--color-sidebar',
  '--color-container',
  '--shadow-card',
]) {
  if (!css.includes(needle)) fails.push(`styles.css missing: ${needle}`)
}
const root = readFileSync('src/routes/__root.tsx', 'utf8')
if (!/html[^>]*className="dark"/.test(root)) fails.push('__root.tsx html missing dark class')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('structure ok')
