import { readFileSync } from 'node:fs'

const sourceFiles = {
  styles: '../src/styles.css',
  admin: '../src/routes/admin.tsx',
  login: '../src/routes/login.tsx',
  root: '../src/routes/__root.tsx',
  sidebar: '../src/components/ui/sidebar.tsx',
  glass: '../src/components/ui/liquid-glass.tsx',
  button: '../src/components/ui/button.tsx',
  input: '../src/components/ui/input.tsx',
  card: '../src/components/ui/card.tsx',
  table: '../src/components/ui/table.tsx',
  checkbox: '../src/components/ui/checkbox.tsx',
  dropdown: '../src/components/ui/dropdown-menu.tsx',
  pagination: '../src/components/ui/datatable-1-utils/datatable-1-pagination.tsx',
}

const expectedDestinations = [
  '/admin',
  '/admin/media-library',
  '/admin/genres',
  '/admin/movies',
  '/admin/tv-shows',
  '/admin/series',
  '/admin/episodes',
  '/admin/teaching',
  '/admin/teaching-volumes',
  '/admin/teaching-episodes',
  '/admin/videos',
  '/admin/tv-category',
  '/admin/live-tv',
  '/admin/actors',
  '/admin/directors',
  '/admin/vast-ads',
  '/admin/custom-ads',
  '/admin/subscriptions',
  '/admin/plans',
  '/admin/plan-limits',
  '/admin/rent-history',
  '/admin/coupons',
  '/admin/users',
  '/admin/soon-to-expire',
  '/admin/banners',
  '/admin/constants',
  '/admin/notification-templates',
  '/admin/settings',
  '/admin/pages',
  '/admin/onboarding',
  '/admin/tax',
  '/admin/faq',
  '/admin/language',
  '/admin/world',
  '/admin/currency',
  '/admin/countries',
  '/admin/access-control',
]

function loadSources() {
  return Object.fromEntries(
    Object.entries(sourceFiles).map(([key, path]) => [
      key,
      readFileSync(new URL(path, import.meta.url), 'utf8'),
    ]),
  )
}

function verify(sources) {
  const failures = []
  const check = (id, condition) => {
    if (!condition) failures.push(id)
  }
  const { styles, admin, login, root, sidebar, glass, table, dropdown, pagination } = sources
  const ownedSource = Object.values(sources).join('\n')
  const groups = admin.slice(admin.indexOf('const GROUPS'), admin.indexOf('function Logo'))
  const destinations = [...groups.matchAll(/\bto:\s*'(\/admin[^']*)'/g)].map((match) => match[1])

  check('branding.current', [admin, login, root].every((source) => source.includes('GoodNews Halobox')))
  check('branding.no-legacy', !/streamit/i.test(ownedSource))
  check('branding.no-legacy-assets', !/default-image\.jpg/.test(admin + login))
  check('branding.nomenclature', admin.includes("label: 'Teachings'") && admin.includes("label: 'Locations'"))
  check('branding.old-nomenclature', !admin.includes("label: 'Teaching'") && !admin.includes("label: 'Directors'"))
  check('nav.destination-count', destinations.length === 37 && new Set(destinations).size === 37)
  check(
    'nav.destinations',
    expectedDestinations.every((destination) => destinations.includes(destination)) &&
      destinations.every((destination) => expectedDestinations.includes(destination)),
  )
  check('nav.grouping', (groups.match(/title: '/g) ?? []).length >= 5)
  check('nav.parent-child-active', admin.includes('childActive') && sidebar.includes('data-active') && sidebar.includes('aria-current'))
  check('nav.closes-on-selection', sidebar.includes('setMobileOpen(false)') && sidebar.includes('onClick={(event)'))

  check('auth.guard', /beforeLoad:\s*async\s*\(\)\s*=>\s*\{\s*const admin = await getAdminSession\(\)/.test(admin))
  check('auth.redirect', admin.includes("if (!admin) throw redirect({ to: '/login' })"))
  check('auth.login-call', login.includes('login({ data: { email, password } })'))
  check('root.metadata', root.includes("{ title: 'GoodNews Halobox Admin' }") && root.includes("content: '#07111f'"))

  check('mobile.native-dialog', sidebar.includes('<dialog') && sidebar.includes('dialog.showModal()') && sidebar.includes('dialog.close()'))
  check('mobile.escape', sidebar.includes('onCancel={(event)') && sidebar.includes('event.preventDefault()'))
  check('mobile.backdrop', sidebar.includes('sidebar-dialog::backdrop') || styles.includes('.sidebar-dialog::backdrop'))
  check('mobile.named-controls', sidebar.includes('aria-label="Open navigation"') && sidebar.includes('aria-label="Close navigation"'))
  check('mobile.dialog-name', sidebar.includes('aria-labelledby="admin-mobile-navigation-title"'))
  check('mobile.focus-return', sidebar.includes('onClose={() => menuButtonRef.current?.focus()}'))
  check('mobile.scroll-containment', sidebar.includes('document.body.style.overflow = "hidden"') && sidebar.includes('document.body.style.overflow = previousOverflow'))
  check('desktop.not-hover-dependent', !sidebar.includes('onMouseEnter') && !sidebar.includes('onMouseLeave'))
  check('desktop.keyboard-toggle', sidebar.includes('aria-expanded={open}') && sidebar.includes('setOpen((value) => !value)'))

  check('login.labels', login.includes('htmlFor="login-email"') && login.includes('htmlFor="login-password"'))
  check('login.autocomplete', login.includes('autoComplete="email"') && login.includes('autoComplete="current-password"'))
  check('login.password-state', login.includes('aria-pressed={showPw}') && login.includes("showPw ? 'Hide password' : 'Show password'"))
  check('login.error-role', login.includes('id="login-error" role="alert"'))
  check('login.busy-state', login.includes('aria-busy={busy}') && login.includes('disabled={busy}'))
  check('login.no-demo-credentials', !/demo[- ]?(credential|account)|admin@admin|password123/i.test(login))
  check('glass.compatibility', glass.includes('GlassEffect') && glass.includes('GlassDock') && glass.includes('GlassButton') && glass.includes('GlassFilter'))

  check('styles.tailwind-import', /^@import "tailwindcss";/.test(styles))
  check('styles.tailwind-theme', styles.includes('@theme inline') && styles.includes('--color-primary: var(--primary)'))
  check(
    'styles.tokens',
    ['#07111f', '#0d1929', '#122238', '#60a5fa', '#3b82f6', '#f3f7fc', '#9aabc0'].every((token) => styles.includes(token)),
  )
  check('styles.no-legacy-red', !/#e50914|#b70710|#b00610/i.test(styles))
  check('styles.focus-visible', styles.includes(':focus-visible') && styles.includes('outline: 2px solid var(--ring)'))
  check('styles.reduced-motion', styles.includes('@media (prefers-reduced-motion: reduce)') && styles.includes('transition-duration: 0.01ms !important'))
  check('styles.local-overflow', /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/s.test(styles) && styles.includes('overscroll-behavior-x: contain'))
  check('styles.page-min-width', /\.admin-main\s*\{[^}]*min-width:\s*0/s.test(styles) && /\.admin-body\s*\{[^}]*min-width:\s*0/s.test(styles))
  check('styles.responsive-structure', styles.includes('@media (max-width: 47.99rem)') && styles.includes('.sidebar-desktop { display: none; }'))
  check('styles.responsive-forms', styles.includes('.stat-grid, .modal-form, .form-grid, .settings-grid, .field-row'))
  check('styles.safe-modals', styles.includes('max-height: calc(100dvh - 4rem)') && styles.includes('overflow-y: auto'))
  check('styles.fixed-type-scale', !/font-size:\s*(?:[2-9]|[1-9]\d)(?:\.\d+)?rem/.test(styles))
  check('styles.interactive-states', styles.includes(':hover') && styles.includes(':disabled') && styles.includes(':focus-visible'))
  const legacyClasses = [
    '.breadcrumb', '.toolbar', '.panel', '.dash-grid', '.stat-grid', '.cc-card',
    '.admin-table', '.table-scroll', '.row-actions', '.form-grid', '.field-row',
    '.modal-back', '.modal-backdrop', '.modal-card', '.modal-wide', '.settings-shell',
    '.settings-panel', '.setting-row', '.ud-grid', '.ud-card', '.ml-shell',
    '.upload-btn', '.check-grid', '.date-bar', '.img-field', '.img-preview-lg',
    '.toast-host', '.approval-back',
  ]
  check('styles.legacy-class-compatibility', legacyClasses.every((selector) => styles.includes(selector)))

  check('primitives.local-table-overflow', table.includes('overflow-x-auto') && table.includes('data-slot="table-container"'))
  check('primitives.table-keyboard-region', table.includes('role="region"') && table.includes('tabIndex={0}') && table.includes('aria-label="Scrollable data table"'))
  check('primitives.dropdown-portal', dropdown.includes('<DropdownMenuPrimitive.Portal>') && dropdown.includes('collisionPadding'))
  check('primitives.dropdown-scroll', styles.includes('--radix-dropdown-menu-content-available-height') && styles.includes('.admin-dropdown-content'))
  check('primitives.pagination', pagination.includes('aria-label="Table pagination"') && pagination.includes('aria-current={p === safePage ? "page" : undefined}'))

  return failures
}

function reportFailures(failures) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
}

const baseline = loadSources()
const baselineFailures = verify(baseline)

if (process.argv.includes('--self-test')) {
  if (baselineFailures.length > 0) {
    console.error('Self-test requires a passing positive control.')
    reportFailures(baselineFailures)
    process.exit(1)
  }

  const negativeControls = [
    ['legacy branding', (s) => ({ ...s, admin: s.admin.replaceAll('GoodNews Halobox', 'Streamit') }), 'branding.no-legacy'],
    ['missing destination', (s) => ({ ...s, admin: s.admin.replace("to: '/admin/genres'", "to: '/admin/not-genres'") }), 'nav.destinations'],
    ['changed auth guard', (s) => ({ ...s, admin: s.admin.replace('getAdminSession()', 'getOtherSession()') }), 'auth.guard'],
    ['removed Escape handling', (s) => ({ ...s, sidebar: s.sidebar.replace('onCancel={(event)', 'onIgnore={(event)') }), 'mobile.escape'],
    ['removed focus return', (s) => ({ ...s, sidebar: s.sidebar.replace('onClose={() => menuButtonRef.current?.focus()}', 'onClose={() => undefined}') }), 'mobile.focus-return'],
    ['removed reduced motion', (s) => ({ ...s, styles: s.styles.replace('@media (prefers-reduced-motion: reduce)', '@media (prefers-reduced-motion: no-preference)') }), 'styles.reduced-motion'],
    ['removed Tailwind import', (s) => ({ ...s, styles: s.styles.replace('@import "tailwindcss";', '') }), 'styles.tailwind-import'],
    ['removed table overflow', (s) => ({ ...s, table: s.table.replace('overflow-x-auto', 'overflow-x-visible') }), 'primitives.local-table-overflow'],
    ['static password state', (s) => ({ ...s, login: s.login.replace('aria-pressed={showPw}', 'aria-pressed="false"') }), 'login.password-state'],
    ['legacy brand token', (s) => ({ ...s, styles: s.styles.replace('--primary: #3b82f6', '--primary: #e50914') }), 'styles.tokens'],
  ]

  const selfTestFailures = []
  for (const [name, mutate, expectedFailure] of negativeControls) {
    const failures = verify(mutate(baseline))
    if (!failures.includes(expectedFailure)) {
      selfTestFailures.push(`${name}: expected ${expectedFailure}`)
    } else {
      console.log(`CAUGHT ${name} -> ${expectedFailure}`)
    }
  }

  if (selfTestFailures.length > 0) {
    reportFailures(selfTestFailures)
    process.exit(1)
  }
  console.log('SHARED_SHELL_SELF_TEST_OK')
} else if (baselineFailures.length > 0) {
  reportFailures(baselineFailures)
  process.exit(1)
} else {
  console.log(`SHARED_SHELL_OK ${expectedDestinations.length} destinations`)
}
