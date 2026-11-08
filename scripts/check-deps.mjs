import { readFileSync, existsSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const all = { ...pkg.dependencies, ...pkg.devDependencies }
const required = [
  'clsx', 'tailwind-merge', 'date-fns', 'lucide-react',
  '@radix-ui/react-avatar', '@radix-ui/react-tooltip',
  'framer-motion', 'motion', '@base-ui/react', '@solar-icons/react',
  'class-variance-authority', 'cn', 'recharts', 'tw-animate-css',
  'tailwindcss', '@tailwindcss/vite',
]
const missing = required.filter((d) => !all[d])
const notInstalled = required.filter((d) => !existsSync(`node_modules/${d}/package.json`))
if (missing.length || notInstalled.length) {
  console.error('missing from package.json:', missing.join(', ') || 'none')
  console.error('not installed:', notInstalled.join(', ') || 'none')
  process.exit(1)
}
console.log('deps ok')
