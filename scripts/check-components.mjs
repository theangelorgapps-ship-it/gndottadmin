import { readFileSync, existsSync } from 'node:fs'

const fails = []
const expect = {
  'src/components/ui/member-list.tsx': ['export default MemberList', 'MemberLine'],
  'src/components/ui/sidebar.tsx': ['export const SidebarBody', 'export const SidebarLink', '@tanstack/react-router'],
  'src/components/ui/halo-notification.tsx': ['HaloPolishedNotification', 'HaloPolishedToastSurface'],
  'src/components/ui/approval-card.tsx': ['ApprovalCard', 'ApprovalOption'],
  'src/components/ui/liquid-glass.tsx': ['GlassEffect', 'GlassFilter'],
  'src/components/ui/chart.tsx': ['ChartContainer', 'recharts'],
}
for (const [file, needles] of Object.entries(expect)) {
  if (!existsSync(file)) { fails.push(`${file} missing`); continue }
  const src = readFileSync(file, 'utf8')
  if (src.length < 500) fails.push(`${file} suspiciously small (${src.length} bytes)`)
  for (const n of needles) if (!src.includes(n)) fails.push(`${file} missing: ${n}`)
}
const sidebar = existsSync('src/components/ui/sidebar.tsx') ? readFileSync('src/components/ui/sidebar.tsx', 'utf8') : ''
if (sidebar.includes('next/link')) fails.push('sidebar.tsx still imports next/link')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('components ok')
