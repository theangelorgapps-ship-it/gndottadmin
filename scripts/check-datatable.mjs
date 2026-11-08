import { readFileSync, existsSync } from 'node:fs'

const fails = []
for (const p of [
  'src/components/ui/datatable-1.tsx',
  'src/components/ui/datatable-1-utils/datatable-1-data.ts',
  'src/components/ui/datatable-1-utils/datatable-1-pagination.tsx',
  'src/components/ui/datatable-1-utils/datatable-1-toolbar.tsx',
  'src/components/AdminDataTable.tsx',
]) {
  if (!existsSync(p)) fails.push(`${p} missing`)
}
if (existsSync('src/components/AdminDataTable.tsx')) {
  const src = readFileSync('src/components/AdminDataTable.tsx', 'utf8')
  for (const n of ['Checkbox', 'DropdownMenu', 'Pagination', 'Table']) {
    if (!src.includes(n)) fails.push(`AdminDataTable missing: ${n}`)
  }
}
const wired = {
  'src/components/CrudTable.tsx': 'AdminDataTable',
  'src/components/admin-content.tsx': 'AdminDataTable',
  'src/routes/admin/videos.tsx': 'AdminDataTable',
  'src/routes/admin/live-tv.tsx': 'AdminDataTable',
  'src/routes/admin/genres.tsx': 'AdminDataTable',
  'src/routes/admin/plans.tsx': 'AdminDataTable',
}
for (const [f, needle] of Object.entries(wired)) {
  if (!readFileSync(f, 'utf8').includes(needle)) fails.push(`${f} not using ${needle}`)
}
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('datatable ok')
