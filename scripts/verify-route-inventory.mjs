import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const NAV_ROUTES = [
  '/admin', '/admin/media-library', '/admin/genres', '/admin/movies', '/admin/tv-shows',
  '/admin/series', '/admin/episodes', '/admin/teaching', '/admin/teaching-volumes',
  '/admin/teaching-episodes', '/admin/videos', '/admin/tv-category', '/admin/live-tv', '/admin/live-comments',
  '/admin/actors', '/admin/locations', '/admin/vast-ads', '/admin/custom-ads',
  '/admin/subscriptions', '/admin/plans', '/admin/plan-limits', '/admin/rent-history',
  '/admin/coupons', '/admin/users', '/admin/soon-to-expire', '/admin/banners',
  '/admin/constants', '/admin/notification-templates', '/admin/settings', '/admin/pages',
  '/admin/onboarding', '/admin/tax', '/admin/faq', '/admin/language', '/admin/world',
  '/admin/currency', '/admin/countries', '/admin/access-control',
]
// Detail and compatibility routes remain valid direct URLs without becoming sidebar items.
const NON_NAV_ROUTES = ['/admin/user/$id', '/admin/directors']
const ALL_ROUTES = [...NAV_ROUTES, ...NON_NAV_ROUTES]
const read = path => readFileSync(join(root, path), 'utf8')
const normalize = path => path === '/admin/' ? '/admin' : path
const parse = (source, path) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
function walk(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? walk(path) : /\.tsx?$/.test(entry.name) ? [path] : []
  }).sort()
}
function visit(node, callback) { callback(node); ts.forEachChild(node, child => visit(child, callback)) }
function fileRoutePaths(source, path) {
  const routes = []
  visit(parse(source, path), node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createFileRoute' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) routes.push(normalize(node.arguments[0].text))
  })
  return routes
}
function generatedAdminPaths(source) {
  const tree = parse(source, 'src/routeTree.gen.ts')
  const destinations = tree.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'FileRoutesByTo')
  if (!destinations) return []
  return destinations.members.flatMap(node => ts.isPropertySignature(node) && node.name && ts.isStringLiteral(node.name) && /^\/admin(?:\/|$)/.test(node.name.text) ? [normalize(node.name.text)] : [])
}
function navigationPaths(source) {
  const paths = []
  visit(parse(source, 'src/routes/admin.tsx'), node => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.name.text !== 'GROUPS' || !node.initializer) return
    visit(node.initializer, property => {
      if (ts.isPropertyAssignment(property) && property.name.getText() === 'to' && ts.isStringLiteral(property.initializer)) paths.push(normalize(property.initializer.text))
    })
  })
  return paths
}
function rendersComponent(source, path, name) {
  let imported = false, rendered = false
  visit(parse(source, path), node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const bindings = node.importClause?.namedBindings
      imported ||= Boolean(bindings && ts.isNamedImports(bindings) && bindings.elements.some(item => item.name.text === name))
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === name) rendered = true
  })
  return imported && rendered
}

const visibleAttributes = new Set(['label', 'title', 'group', 'singular', 'empty', 'searchPlaceholder', 'placeholder', 'aria-label', 'alt', 'description', 'approveLabel'])
const visibleProperties = new Set(['label', 'tabLabel', 'title', 'description', 'placeholder', 'approveLabel', 'empty'])
const forbidden = /\b(?:streamit|imdb|reviews?|ratings?|stars?|movies?|tv[\s_-]*shows?|actors?|directors?|cast|genres?)\b|[★☆]/i
function visibleText(source, path) {
  const file = parse(source, path), values = []
  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text)
    if (ts.isTemplateExpression(node)) { values.push(node.head.text); for (const span of node.templateSpans) values.push(span.literal.text) }
  }
  visit(file, node => {
    if (ts.isJsxText(node)) { const text = node.getText(file).replace(/\s+/g, ' ').trim(); if (text) values.push(text) }
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.text) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) literal(node.initializer)
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) literal(node.initializer.expression)
    }
    if (ts.isPropertyAssignment(node) && visibleProperties.has(node.name.text)) literal(node.initializer)
    if (node.parent && ts.isJsxExpression(node.parent)) literal(node)
  })
  return values
}
function checkSet(actual, expected, label, failures) {
  const actualSet = new Set(actual), expectedSet = new Set(expected)
  if (actual.length !== actualSet.size) failures.push(`${label} contains duplicate destinations`)
  for (const path of expectedSet) if (!actualSet.has(path)) failures.push(`${label} is missing ${path}`)
  for (const path of actualSet) if (!expectedSet.has(path)) failures.push(`${label} contains unexpected ${path}`)
}
function verify(sources) {
  const failures = []
  const check = (condition, message) => { if (!condition) failures.push(message) }
  const source = path => sources.get(path) ?? ''
  const routeFiles = [...sources.keys()].filter(path => path.startsWith('src/routes/admin/') && /\.tsx?$/.test(path))
  check(NAV_ROUTES.length === 38, 'Canonical navigation must contain 38 destinations')
  check(ALL_ROUTES.length === 40 && new Set(ALL_ROUTES).size === 40, 'Canonical admin manifest must contain 40 distinct destinations')
  check(routeFiles.length === 40, `Expected 40 admin route files, measured ${routeFiles.length}`)
  const declared = routeFiles.flatMap(path => {
    const paths = fileRoutePaths(source(path), path)
    check(paths.length === 1, `${path} must declare exactly one file route`)
    return paths
  })
  checkSet(declared, ALL_ROUTES, 'Source routes', failures)
  checkSet(generatedAdminPaths(source('src/routeTree.gen.ts')), ALL_ROUTES, 'Generated route tree', failures)
  checkSet(navigationPaths(source('src/routes/admin.tsx')), NAV_ROUTES, 'Navigation', failures)
  for (const path of ['src/routes/admin.tsx', 'src/routes/login.tsx', 'src/components/ui/sidebar.tsx']) check(rendersComponent(source(path), path, 'AdminBrand'), `${path} must import and render AdminBrand`)
  check(rendersComponent(source('src/routes/admin.tsx'), 'src/routes/admin.tsx', 'SidebarWithTabs'), 'Admin workspace must import and render SidebarWithTabs')
  const brand = source('src/components/AdminBrand.tsx')
  check(visibleText(brand, 'src/components/AdminBrand.tsx').some(value => value.includes('GoodNews Halobox')) && brand.includes('goodnews-halo-logo.avif'), 'AdminBrand must retain the canonical Halobox name and image')
  check(source('src/routes/__root.tsx').includes('GoodNews Halobox'), 'Document metadata must retain GoodNews Halobox branding')
  for (const [path, content] of sources) {
    if (path === 'src/routeTree.gen.ts') continue
    for (const text of visibleText(content, path)) {
      // The legacy direct URL retains its own terminology; this exception never applies to navigation or any other obsolete vocabulary.
      const reviewed = path === 'src/routes/admin/directors.tsx' ? text.replace(/\bdirectors?\b/ig, '') : text
      check(!forbidden.test(reviewed), `${path} contains forbidden visible vocabulary: ${JSON.stringify(text)}`)
    }
  }
  return failures
}

const paths = [
  'src/routeTree.gen.ts', 'src/routes/admin.tsx', 'src/routes/login.tsx', 'src/routes/__root.tsx',
  ...walk('src/routes/admin'),
  'src/components/AdminBrand.tsx', 'src/components/AdminProfileMenu.tsx', 'src/components/ui/sidebar.tsx',
  'src/components/ui/sidebar-with-chrome-like-tabs.tsx',
  'src/components/AdminDataTable.tsx', 'src/components/AdminTable.tsx', 'src/components/CrudTable.tsx',
  'src/components/admin-content.tsx', 'src/components/SeriesAdmin.tsx', 'src/components/Poster.tsx',
  'src/components/UploadDialog.tsx', 'src/components/HeroBannerEditor.tsx', 'src/lib/confirm.tsx', 'src/lib/toast.tsx',
]
const sources = new Map(paths.map(path => [path, read(path)]))
const failures = verify(sources)
if (process.argv.includes('--self-test')) {
  const controls = [
    ['missing compatibility route', draft => draft.delete('src/routes/admin/directors.tsx'), 'Source routes is missing /admin/directors'],
    ['same-count wrong route', draft => draft.set('src/routes/admin/locations.tsx', draft.get('src/routes/admin/locations.tsx').replace("createFileRoute('/admin/locations')", "createFileRoute('/admin/unexpected')")), 'Source routes contains unexpected /admin/unexpected'],
    ['missing generated route', draft => draft.set('src/routeTree.gen.ts', draft.get('src/routeTree.gen.ts').replaceAll("  '/admin/locations': typeof AdminLocationsRoute\n", '')), 'Generated route tree is missing /admin/locations'],
    ['legacy route leaked into navigation', draft => draft.set('src/routes/admin.tsx', draft.get('src/routes/admin.tsx').replace("to: '/admin/locations'", "to: '/admin/directors'")), 'Navigation contains unexpected /admin/directors'],
    ['missing brand rendering', draft => draft.set('src/routes/login.tsx', draft.get('src/routes/login.tsx').replace('<AdminBrand link={false} />', '<div />')), 'src/routes/login.tsx must import and render AdminBrand'],
    ['missing tabbed shell rendering', draft => draft.set('src/routes/admin.tsx', draft.get('src/routes/admin.tsx').replace(/<SidebarWithTabs\b/g, '<div')), 'Admin workspace must import and render SidebarWithTabs'],
    ['obsolete vocabulary', draft => draft.set('src/routes/admin/locations.tsx', draft.get('src/routes/admin/locations.tsx').replace('>Locations<', '>Reviews and IMDb ratings<')), 'forbidden visible vocabulary'],
    ['compatibility exception remains narrow', draft => draft.set('src/routes/admin/directors.tsx', draft.get('src/routes/admin/directors.tsx').replace('title="Directors"', 'title="Movie Reviews"')), 'forbidden visible vocabulary'],
  ]
  for (const [name, mutate, expected] of controls) {
    const draft = new Map(sources); mutate(draft)
    if (!verify(draft).some(message => message.includes(expected))) failures.push(`Negative control was not rejected: ${name}`)
  }
} else {
  for (const [args, marker] of [[['run', 'typecheck'], 'TYPECHECK_OK'], [['run', 'build'], '✓ built']]) {
    const result = spawnSync('npm', args, { cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024, timeout: 120000 })
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    if (result.status !== 0 || !output.includes(marker)) { failures.push(`npm ${args.join(' ')} did not produce ${marker}`); console.error(output) }
  }
}
if (failures.length) {
  console.error(`ROUTE_INVENTORY_FAILED ${failures.length} failure(s)`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(process.argv.includes('--self-test') ? 'ROUTE_INVENTORY_SELF_TEST_OK routes=40 nav=38 controls=8' : 'ROUTE_INVENTORY_OK routes=40 nav=38')
