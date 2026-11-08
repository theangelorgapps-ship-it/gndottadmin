import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const paths = {
  dashboard: 'src/routes/admin/index.tsx',
  users: 'src/routes/admin/users.tsx',
  detail: 'src/routes/admin/user.$id.tsx',
  subscriptions: 'src/routes/admin/subscriptions.tsx',
  expiry: 'src/routes/admin/soon-to-expire.tsx',
  access: 'src/routes/admin/access-control.tsx',
}

function loadSources() {
  return Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(join(root, path), 'utf8')]))
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function visibleFragments(source) {
  const clean = withoutComments(source)
  const fragments = []
  for (const match of clean.matchAll(/>([^<>{}]+)</g)) fragments.push(match[1])
  for (const match of clean.matchAll(/\b(?:label|title|aria-label|alt|placeholder|description)\s*=\s*["']([^"']*)["']/g)) fragments.push(match[1])
  for (const match of clean.matchAll(/\b(?:label|title|empty|approveLabel|description):\s*["']([^"']*)["']/g)) fragments.push(match[1])
  for (const match of clean.matchAll(/\{["']([^"']+)["']\}/g)) fragments.push(match[1])
  return fragments.join('\n')
}

function verify(sources) {
  const failures = []
  const check = (id, condition) => { if (!condition) failures.push(id) }
  const source = (name) => {
    const value = sources[name]
    if (typeof value !== 'string') throw new Error(`Missing source: ${name}`)
    return value
  }
  const expect = (name, id, hook) => check(id, typeof hook === 'string' ? source(name).includes(hook) : hook.test(source(name)))
  const { dashboard, users, detail, subscriptions, expiry, access } = sources

  // Route loaders, URL parsing, links, and server-function contracts.
  expect('dashboard', 'dashboard.route', "createFileRoute('/admin/')")
  expect('dashboard', 'dashboard.search-validation', "validateSearch: (s: Record<string, unknown>)")
  expect('dashboard', 'dashboard.loader-deps', "loaderDeps: ({ search }) => ({ from: search.from, to: search.to })")
  expect('dashboard', 'dashboard.loader', "getAdminStats({ data: { from: deps.from || undefined, to: deps.to || undefined } })")
  expect('dashboard', 'dashboard.navigation', "router.navigate({ search: { from: nextFrom, to: nextTo } as any })")
  const dashboardDestinations = [
    '/admin/users', '/admin/subscriptions', '/admin/soon-to-expire', '/admin/teaching', '/admin/rent-history',
    '/admin/movies', '/admin/tv-shows', '/admin/videos', '/admin/live-tv', '/admin/genres', '/admin/plans', '/admin/actors',
  ]
  for (const destination of dashboardDestinations) expect('dashboard', `dashboard.link.${destination}`, destination)
  expect('users', 'users.route', "createFileRoute('/admin/users')")
  expect('users', 'users.loader', 'loader: async () => await adminListUsers()')
  expect('users', 'users.mutation', 'adminSetUserBanned({ data: { id, banned } })')
  expect('users', 'users.invalidate', 'router.invalidate()')
  expect('users', 'users.detail-link', 'to={`/admin/user/${user.id}` as any}')
  for (const field of ['profiles', 'is_subscribe', 'is_banned', 'created_at', 'user_type']) {
    expect('users', `users.field.${field}`, new RegExp(`user\\.${field}\\b`))
  }
  expect('detail', 'detail.route', "createFileRoute('/admin/user/$id')")
  expect('detail', 'detail.loader', 'adminUserDetail({ data: Number(params.id) })')
  expect('detail', 'detail.mutation', 'adminSetUserBanned({ data: { id: user.id, banned: !banned } })')
  expect('detail', 'detail.invalidate', 'router.invalidate()')
  expect('detail', 'detail.loader-shape', 'const { user, subscription, watchlistCount, rents, profiles } = Route.useLoaderData() as any')
  for (const field of ['plan_name', 'start_date', 'end_date', 'total_amount', 'view_expiry_date', 'is_child_profile']) {
    expect('detail', `detail.field.${field}`, new RegExp(`\\b${field}\\b`))
  }
  expect('subscriptions', 'subscriptions.route', "createFileRoute('/admin/subscriptions')")
  expect('subscriptions', 'subscriptions.loader', 'loader: async () => await adminListSubscriptions()')
  expect('subscriptions', 'subscriptions.loader-shape', 'const { subscriptions, transactions } = Route.useLoaderData()')
  for (const field of ['user_email', 'plan_name', 'total_amount', 'start_date', 'end_date', 'transaction_id', 'payment_type', 'payment_status']) {
    expect('subscriptions', `subscriptions.field.${field}`, new RegExp(`\\b${field}\\b`))
  }
  expect('expiry', 'expiry.route', "createFileRoute('/admin/soon-to-expire')")
  expect('expiry', 'expiry.loader', "loader: async () => await adminTable({ data: 'soon-to-expire' })")
  for (const field of ['user_email', 'end_date', 'amount']) expect('expiry', `expiry.field.${field}`, new RegExp(`row\\.${field}\\b`))
  expect('access', 'access.route', "createFileRoute('/admin/access-control')")
  expect('access', 'access.roles-loader', "adminTable({ data: 'access-control' })")
  expect('access', 'access.permissions-loader', 'adminListPermissions()')
  expect('access', 'access.get-role', 'adminGetRole({ data: id })')
  expect('access', 'access.upsert-role', 'adminUpsertRole({ data: form })')
  expect('access', 'access.delete-role', 'adminDeleteRole({ data: role.id })')
  expect('access', 'access.permission-payload', 'permission_ids')
  expect('access', 'access.permission-grouping', "String(p.name).split(/[_-]/)[0] || 'general'")
  expect('access', 'access.invalidate', 'router.invalidate()')

  // Existing trend and genre calculations remain intact and use the current palette.
  expect('dashboard', 'dashboard.spark-series', '[...series].reverse().map((r) => Number(r.n) || 0)')
  expect('dashboard', 'dashboard.spark-padding', 'while (pts.length < 6) pts.unshift(0)')
  expect('dashboard', 'dashboard.spark-calculation', 'Math.round(((last - prev) / prev) * 100)')
  expect('dashboard', 'dashboard.genre-total', 'data.reduce((s, g) => s + Number(g.n), 0)')
  expect('dashboard', 'dashboard.genre-data', 'dataKey="n"')
  expect('dashboard', 'dashboard.genre-names', 'nameKey="name"')
  expect('dashboard', 'dashboard.monthly-rent', 'data.monthly.rentContent')
  expect('dashboard', 'dashboard.monthly-subscriptions', 'data.monthly.activeSubs')
  check('dashboard.current-palette', dashboard.includes("'#60a5fa', '#3b82f6', '#34d399', '#fbbf24', '#a5b4fc'"))

  // Current vocabulary applies to visible copy while internal route/data keys remain compatible.
  const forbiddenVisible = /\b(?:reviews?|ratings?|stars?|imdb|streamit|movies|tv[\s_-]*shows?|directors?|actors?)\b/i
  for (const name of Object.keys(paths)) {
    check(`vocabulary.visible.${name}`, !forbiddenVisible.test(visibleFragments(source(name))))
    const clean = withoutComments(source(name))
    check(`vocabulary.legacy-capitalized.${name}`, !/\b(?:Reviews?|Ratings?|Movies|TV Shows?|Directors?|Actors?|IMDb|Streamit)\b/.test(clean))
    check(`vocabulary.stars-legacy-colors.${name}`, !/★|☆|#e50914|#b00610|#b70710/i.test(clean))
    check(`vocabulary.navy-system.${name}`, /bg-background|var\(--card\)|cc-card|\bpanel\b/.test(clean))
  }
  check('vocabulary.detail-no-review-ui', !/\b(?:reviews?|ratings?|stars?)\b/i.test(withoutComments(detail)))
  for (const phrase of ['Sermons', 'Shows', 'Teachings', 'Videos', 'Personalities']) {
    expect('dashboard', `vocabulary.dashboard.${phrase}`, phrase)
  }
  expect('detail', 'vocabulary.detail-content-names', "movie: 'Sermon'")
  expect('access', 'vocabulary.access-permission-names', "formatPermissionName(permission.name)")
  expect('access', 'vocabulary.access-location-mapping', "/\\bdirectors?\\b/gi, 'Locations'")
  expect('access', 'vocabulary.access-personality-mapping', "/\\bactors?\\b/gi, 'Personalities'")

  // Structural mobile layouts, named controls, useful state, and contained overflow.
  check('responsive.dashboard', dashboard.includes('grid-cols-1') && dashboard.includes('sm:grid-cols-2') && dashboard.includes('dash-grid'))
  for (const name of ['users', 'detail', 'subscriptions', 'expiry']) {
    check(`responsive.${name}`, source(name).includes('hidden md:block') && source(name).includes('md:hidden'))
  }
  const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
  check('responsive.access', source('access').includes('table-scroll roles-table-desktop') && source('access').includes('md:hidden')
    && styles.includes('.roles-table-desktop { display: none; }')
    && styles.includes('@media (min-width: 48rem) { .roles-table-desktop { display: block; } }'))
  for (const name of Object.keys(paths)) {
    check(`overflow.${name}`, source(name).includes('min-w-0') && !/w-screen|min-w-screen|overflow-x-visible/.test(source(name)))
  }
  for (const name of ['users', 'detail', 'subscriptions', 'expiry', 'access']) {
    check(`overflow.table-region.${name}`, /aria-label="Scrollable [^"]+" tabIndex=\{0\}/.test(source(name)))
  }
  expect('users', 'accessibility.user-search', '<label htmlFor="user-search" className="sr-only">')
  expect('users', 'accessibility.access-switch', 'role="switch"')
  expect('users', 'accessibility.access-switch-state', 'aria-checked={!banned}')
  expect('users', 'accessibility.access-switch-name', 'aria-label={`Account access for ${name}`}')
  expect('users', 'state.busy', 'aria-busy={busy}')
  expect('users', 'state.error', 'role="alert"')
  expect('users', 'state.empty', 'No matching users')
  expect('detail', 'state.busy', 'aria-busy={busy}')
  expect('detail', 'state.error', 'role="alert"')
  expect('detail', 'state.empty', 'No rentals')
  expect('subscriptions', 'accessibility.search', '<label htmlFor="subscription-search" className="sr-only">')
  expect('subscriptions', 'state.empty', 'No matching subscriptions')
  expect('expiry', 'accessibility.search', '<label htmlFor="expiry-search" className="sr-only">')
  expect('expiry', 'state.empty', 'No upcoming expiries')
  expect('dashboard', 'accessibility.date-from', '<label htmlFor="dashboard-from"')
  expect('dashboard', 'accessibility.date-to', '<label htmlFor="dashboard-to"')
  expect('dashboard', 'state.busy', 'aria-busy={busy}')
  expect('dashboard', 'state.error', 'role="alert"')
  expect('dashboard', 'state.empty-content', 'No content in this period')
  expect('dashboard', 'state.empty-transactions', 'No transactions in this period')
  expect('dashboard', 'state.empty-genres', 'No genre mappings yet')

  // Every native control has an explicit type or alternative text, including controls added later.
  for (const name of Object.keys(paths)) {
    const clean = withoutComments(source(name))
    const buttons = clean.match(/<button\b[^>]*>/gs) ?? []
    const images = clean.match(/<img\b[^>]*>/gs) ?? []
    check(`accessibility.button-types.${name}`, buttons.every((button) => /\btype=/.test(button)))
    check(`accessibility.image-alternatives.${name}`, images.every((image) => /\balt=/.test(image)))
  }

  // Role editor is a named native dialog with focus containment/return and safe busy behavior.
  expect('access', 'access.dialog-native', '<dialog')
  expect('access', 'access.dialog-focus', 'dialog.showModal()')
  expect('access', 'access.dialog-close', 'dialog.close()')
  expect('access', 'access.dialog-focus-return', 'previousFocus.focus()')
  expect('access', 'access.dialog-title', 'aria-labelledby={titleId}')
  expect('access', 'access.dialog-help', 'aria-describedby={helpId}')
  expect('access', 'access.dialog-escape', 'onCancel={(event)')
  expect('access', 'access.dialog-backdrop', 'getBoundingClientRect()')
  expect('access', 'access.dialog-initial-focus', 'data-initial-focus')
  expect('access', 'access.dialog-busy', 'aria-busy={busy}')
  expect('access', 'access.dialog-submit', 'type="submit"')
  expect('access', 'access.dialog-name-label', '<label htmlFor={nameId}>')
  expect('access', 'access.dialog-title-label', '<label htmlFor={displayTitleId}>')
  expect('access', 'access.delete-confirmation', 'confirmAction({')
  expect('access', 'state.empty', 'No roles configured')
  expect('access', 'state.error', 'role="alert"')

  return [...new Set(failures)]
}

function report(failures) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
}

const baseline = loadSources()
const baselineFailures = verify(baseline)

if (process.argv.includes('--self-test')) {
  if (baselineFailures.length > 0) {
    console.error('Self-test requires a passing positive control.')
    report(baselineFailures)
    process.exit(1)
  }

  const negativeControls = [
    {
      name: 'removed user mutation payload',
      mutate: (s) => ({ ...s, users: s.users.replace('adminSetUserBanned({ data: { id, banned } })', 'adminSetUserBanned({ data: { id } })') }),
      expected: 'users.mutation',
    },
    {
      name: 'changed trend calculation',
      mutate: (s) => ({ ...s, dashboard: s.dashboard.replace('Math.round(((last - prev) / prev) * 100)', '0') }),
      expected: 'dashboard.spark-calculation',
    },
    {
      name: 'added legacy visible vocabulary',
      mutate: (s) => ({ ...s, users: s.users.replace('>Users</span>', '>Reviews</span>') }),
      expected: 'vocabulary.visible.users',
    },
    {
      name: 'added a rating symbol',
      mutate: (s) => ({ ...s, detail: s.detail.replace('<h1 className="m-0 break-words">{name}</h1>', '<h1 className="m-0 break-words">{name} ★</h1>') }),
      expected: 'vocabulary.stars-legacy-colors.detail',
    },
    {
      name: 'removed role dialog focus containment',
      mutate: (s) => ({ ...s, access: s.access.replace('dialog.showModal()', 'dialog.setAttribute("open", "")') }),
      expected: 'access.dialog-focus',
    },
    {
      name: 'removed structural mobile expiry records',
      mutate: (s) => ({ ...s, expiry: s.expiry.replaceAll('md:hidden', 'md:block') }),
      expected: 'responsive.expiry',
    },
    {
      name: 'removed accessible user toggle state',
      mutate: (s) => ({ ...s, users: s.users.replace('aria-checked={!banned}', 'aria-checked="false"') }),
      expected: 'accessibility.access-switch-state',
    },
  ]

  const selfTestFailures = []
  for (const control of negativeControls) {
    const failures = verify(control.mutate(baseline))
    if (!failures.includes(control.expected)) {
      selfTestFailures.push(`${control.name}: expected ${control.expected}`)
    } else {
      console.log(`CAUGHT ${control.name} -> ${control.expected}`)
    }
  }
  if (selfTestFailures.length > 0) {
    report(selfTestFailures)
    process.exit(1)
  }
  console.log(`PEOPLE_DASHBOARD_SELF_TEST_OK ${negativeControls.length} defects rejected`)
} else if (baselineFailures.length > 0) {
  report(baselineFailures)
  process.exit(1)
} else {
  console.log(`PEOPLE_DASHBOARD_OK ${Object.keys(paths).length} routes verified`)
}
