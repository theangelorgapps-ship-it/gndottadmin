import { readFileSync } from 'node:fs'

const fails = []
const dash = readFileSync('src/routes/admin/index.tsx', 'utf8')
if (!dash.includes('components/ui/chart')) fails.push('dashboard does not import ui/chart')
if (!dash.includes('recharts')) fails.push('dashboard does not import recharts')
if (!dash.includes('PieChart')) fails.push('dashboard does not render a PieChart')
if (dash.includes('strokeDasharray={`${pct} ${100 - pct}`}')) fails.push('old hand-rolled donut still present')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('chart ok')
