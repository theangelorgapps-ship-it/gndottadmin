import { readFileSync } from 'node:fs'

const fails = []
const login = readFileSync('src/routes/login.tsx', 'utf8')
if (!login.includes('liquid-glass')) fails.push('login.tsx does not import ui/liquid-glass')
if (!login.includes('GlassEffect')) fails.push('login.tsx does not render GlassEffect')
if (!login.includes('GlassFilter')) fails.push('login.tsx does not mount GlassFilter')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('glass ok')
