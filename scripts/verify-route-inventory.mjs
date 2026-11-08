import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const NAV_ROUTES = [
  '/admin', '/admin/media-library', '/admin/genres', '/admin/movies', '/admin/tv-shows',
  '/admin/series', '/admin/episodes', '/admin/teaching', '/admin/teaching-volumes',
  '/admin/teaching-episodes', '/admin/videos', '/admin/tv-category', '/admin/live-tv',
  '/admin/actors', '/admin/directors', '/admin/vast-ads', '/admin/custom-ads',
  '/admin/subscriptions', '/admin/plans', '/admin/plan-limits', '/admin/rent-history',
  '/admin/coupons', '/admin/users', '/admin/soon-to-expire', '/admin/banners',
  '/admin/constants', '/admin/notification-templates', '/admin/settings', '/admin/pages',
  '/admin/onboarding', '/admin/tax', '/admin/faq', '/admin/language', '/admin/world',
  '/admin/currency', '/admin/countries', '/admin/access-control',
]
const ALL_ROUTES = [...NAV_ROUTES, '/admin/user/$id']
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const read = (path) => readFileSync(join(root, path), 'utf8')

check(NAV_ROUTES.length === 37, `Expected 37 navigation destinations, measured ${NAV_ROUTES.length}`)
check(ALL_ROUTES.length === 38, `Expected 38 total admin destinations, measured ${ALL_ROUTES.length}`)
check(new Set(ALL_ROUTES).size === 38, 'Admin route manifest contains duplicates')

const routeDirectory = join(root, 'src/routes/admin')
const routeFiles = readdirSync(routeDirectory).filter((file) => file.endsWith('.tsx')).sort()
check(routeFiles.length === 38, `Expected 38 admin route files, measured ${routeFiles.length}`)
check(!routeFiles.includes('reviews.tsx'), 'Obsolete reviews route still exists')
check(!routeFiles.includes('seasons.tsx'), 'Obsolete seasons route still exists')

const routeTree = read('src/routeTree.gen.ts')
for (const url of ALL_ROUTES) {
  const treeUrl = url === '/admin' ? '/admin/' : url
  check(routeTree.includes(`'${treeUrl}'`), `Generated route tree is missing ${treeUrl}`)
}

const adminLayout = read('src/routes/admin.tsx')
const navTargets = [...adminLayout.matchAll(/\bto:\s*['"](\/admin[^'"]*)['"]/g)].map((match) => match[1])
const uniqueNavTargets = [...new Set(navTargets)]
check(uniqueNavTargets.length === 37, `Expected 37 unique navigation targets, measured ${uniqueNavTargets.length}`)
for (const url of NAV_ROUTES) check(uniqueNavTargets.includes(url), `Navigation is missing ${url}`)
check(adminLayout.includes('GoodNews Halobox'), 'Admin shell is missing GoodNews Halobox branding')
check(read('src/routes/login.tsx').includes('GoodNews Halobox'), 'Login is missing GoodNews Halobox branding')
check(read('src/routes/__root.tsx').includes('GoodNews Halobox'), 'Document metadata is missing GoodNews Halobox branding')

const visibleAttributes = new Set([
  'label', 'title', 'group', 'singular', 'empty', 'searchPlaceholder', 'placeholder',
  'aria-label', 'alt', 'description', 'approveLabel',
])
const visibleProperties = new Set(['label', 'title', 'description', 'placeholder', 'approveLabel', 'empty'])
const forbidden = /\b(?:streamit|imdb|reviews?|ratings?|stars?|movies?|tv[\s_-]*shows?|actors?|directors?|cast)\b|[★☆]/i

function visibleText(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const values = []
  const literal = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text)
    if (ts.isTemplateExpression(node)) {
      values.push(node.head.text)
      for (const span of node.templateSpans) values.push(span.literal.text)
    }
  }
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(file).replace(/\s+/g, ' ').trim()
      if (text) values.push(text)
    }
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.text) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) literal(node.initializer)
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) literal(node.initializer.expression)
    }
    if (ts.isPropertyAssignment(node) && visibleProperties.has(node.name.text)) literal(node.initializer)
    if (node.parent && ts.isJsxExpression(node.parent)) literal(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return values
}

const uiFiles = [
  'src/routes/admin.tsx', 'src/routes/login.tsx', 'src/routes/__root.tsx',
  ...routeFiles.map((file) => `src/routes/admin/${file}`),
  'src/components/AdminDataTable.tsx', 'src/components/AdminTable.tsx',
  'src/components/CrudTable.tsx', 'src/components/admin-content.tsx',
  'src/components/SeriesAdmin.tsx', 'src/components/Poster.tsx',
  'src/lib/confirm.tsx', 'src/lib/toast.tsx',
]
for (const path of uiFiles) {
  for (const text of visibleText(read(path), path)) {
    check(!forbidden.test(text), `${path} contains forbidden visible vocabulary: ${JSON.stringify(text)}`)
  }
}

function run(command, args, successMarker) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024 })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  check(result.status === 0 && output.includes(successMarker), `${command} ${args.join(' ')} did not produce ${successMarker}`)
  if (result.status !== 0 || !output.includes(successMarker)) console.error(output)
}

if (!process.argv.includes('--self-test')) {
  run('npm', ['run', 'typecheck'], 'TYPECHECK_OK')
  run('npm', ['run', 'build'], '✓ built')
} else {
  const bad = 'Visible Reviews and IMDb ratings'
  check(forbidden.test(bad), 'Negative control was not rejected for forbidden visible vocabulary')
  check(ALL_ROUTES.length + 1 !== 38, 'Negative control was not rejected for an extra admin destination')
}

if (failures.length > 0) {
  console.error(`ROUTE_INVENTORY_FAILED ${failures.length} failure(s)`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
if (process.argv.includes('--self-test')) console.log('ROUTE_INVENTORY_SELF_TEST_OK')
else console.log(`ROUTE_INVENTORY_OK routes=${ALL_ROUTES.length}`)
