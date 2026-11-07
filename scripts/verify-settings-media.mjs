import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const settingsPath = `${root}src/routes/admin/settings.tsx`
const mediaPath = `${root}src/routes/admin/media-library.tsx`
const stylesPath = `${root}src/styles.css`

const T = (type, name, kind = '') => [type, name, kind]
const CANONICAL_TABS = [
  ['business', 'Business Settings', [
    T('bussiness', 'app_name'), T('bussiness', 'helpline_number'), T('bussiness', 'inquriy_email'),
    T('bussiness', 'short_description', 'textarea'), T('bussiness', 'facebook_url'), T('bussiness', 'x_url'),
    T('bussiness', 'instagram_url'), T('bussiness', 'youtube_url'),
  ]],
  ['custom-code', 'Custom Code', []],
  ['module', 'Module Settings', [
    T('module_settings', 'movie', 'toggle'), T('module_settings', 'tvshow', 'toggle'),
    T('module_settings', 'livetv', 'toggle'), T('module_settings', 'video', 'toggle'),
    T('module_settings', 'demo_login', 'toggle'),
  ]],
  ['misc', 'Misc Settings', [
    T('misc', 'default_language'), T('misc', 'default_time_zone'), T('misc', 'forward_seconds'),
    T('misc', 'backward_seconds'), T('misc', 'disc_type'), T('appconfig', 'is_social_login', 'toggle'),
    T('appconfig', 'is_google_login', 'toggle'), T('appconfig', 'is_apple_login', 'toggle'),
    T('appconfig', 'is_otp_login', 'toggle'), T('appconfig', 'google_client_id'),
  ]],
  ['customization', 'Customization', [
    T('bussiness', 'app_name'), T('mini_logo', 'mini_logo', 'image'), T('dark_logo', 'dark_logo', 'image'),
    T('favicon', 'favicon', 'image'), T('loader_gif', 'loader_gif', 'image'),
  ]],
  ['mail', 'Mail Settings', []],
  ['notification', 'Notification Settings', [
    T('appconfig', 'is_firebase_notification', 'toggle'), T('appconfig', 'is_user_push_notification', 'toggle'),
  ]],
  ['payment', 'Payment Methods', [
    T('razorpayPayment', 'razor_payment_method', 'toggle'), T('razor_payment_method', 'razorpay_secretkey'),
    T('razor_payment_method', 'razorpay_publickey'), T('stripePayment', 'str_payment_method', 'toggle'),
    T('str_payment_method', 'stripe_secretkey'), T('str_payment_method', 'stripe_publickey'),
    T('paystackPayment', 'paystack_payment_method', 'toggle'), T('paystack_payment_method', 'paystack_secretkey'),
    T('paystack_payment_method', 'paystack_publickey'), T('paypalPayment', 'paypal_payment_method', 'toggle'),
    T('paypal_payment_method', 'paypal_secretkey'), T('paypal_payment_method', 'paypal_clientid'),
    T('flutterwavePayment', 'flutterwave_payment_method', 'toggle'),
    T('flutterwave_payment_method', 'flutterwave_secretkey'), T('flutterwave_payment_method', 'flutterwave_publickey'),
    T('cashpayment', 'cash_payment_method', 'toggle'), T('paymentcinet', 'cinet_payment_method', 'toggle'),
    T('paymentsadad', 'sadad_payment_method', 'toggle'), T('airtelpayment', 'airtel_payment_method', 'toggle'),
    T('phonepepayment', 'phonepe_payment_method', 'toggle'), T('midtranspayment', 'midtrans_payment_method', 'toggle'),
  ]],
  ['language', 'Language Settings', [T('misc', 'default_language')]],
  ['notification-config', 'Notification Configuration', [
    T('appconfig', 'novu_api_key'), T('appconfig', 'novu_application_id'), T('appconfig', 'novu_backend_url'),
  ]],
  ['currency', 'Currency Settings', [T('misc', 'default_currency', 'currency')]],
  ['storage', 'Storage Settings', [
    T('storage_settings', 'local', 'toggle'), T('storage_settings', 's3', 'toggle'),
    T('storage_settings', 'aws_access_key'), T('storage_settings', 'aws_secret_key'),
    T('storage_settings', 'aws_region'), T('storage_settings', 'aws_bucket'),
  ]],
  ['bunny', 'Bunny Stream', [
    T('bunny', 'bunny_library_id'), T('bunny', 'bunny_api_key'), T('bunny', 'bunny_cdn_hostname'),
  ]],
  ['seo', 'SEO Settings', [T('text', 'google_analytics', 'textarea')]],
]

function propertyName(name) {
  if (!name) return ''
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return ''
}

function property(object, name) {
  return object.properties.find((entry) => ts.isPropertyAssignment(entry) && propertyName(entry.name) === name)
}

function stringProperty(object, name) {
  const entry = property(object, name)
  return entry && ts.isStringLiteralLike(entry.initializer) ? entry.initializer.text : ''
}

function readTabInventory(source) {
  const file = ts.createSourceFile('settings.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'TABS') initializer = declaration.initializer
    }
  }
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) return { tabs: [], visibleText: [] }

  const tabs = []
  const visibleText = []
  for (const element of initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue
    const fields = []
    const fieldsProperty = property(element, 'fields')
    if (fieldsProperty && ts.isArrayLiteralExpression(fieldsProperty.initializer)) {
      for (const fieldElement of fieldsProperty.initializer.elements) {
        if (!ts.isObjectLiteralExpression(fieldElement)) continue
        fields.push({
          signature: [stringProperty(fieldElement, 'type'), stringProperty(fieldElement, 'name'), stringProperty(fieldElement, 'kind')].join('|'),
          label: stringProperty(fieldElement, 'label'),
          placeholder: stringProperty(fieldElement, 'placeholder'),
        })
      }
    }
    const tab = {
      id: stringProperty(element, 'id'),
      label: stringProperty(element, 'label'),
      description: stringProperty(element, 'description'),
      note: stringProperty(element, 'note'),
      fields,
    }
    tabs.push(tab)
    visibleText.push(tab.label, tab.description, tab.note)
    for (const field of fields) visibleText.push(field.label, field.placeholder)
  }
  return { tabs, visibleText }
}

function collectVisibleText(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const text = []
  function visit(node) {
    if (ts.isJsxText(node)) text.push(node.getText(file))
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const parent = node.parent
      const isStoredSetting = ts.isPropertyAssignment(parent) && ['type', 'name'].includes(propertyName(parent.name))
      if (!isStoredSetting) text.push(ts.isStringLiteralLike(node) ? node.text : node.getText(file))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return text
}

function verifySources(settings, media, styles) {
  const errors = []
  const requireSnippet = (source, snippet, code) => {
    if (!source.includes(snippet)) errors.push(`[${code}] Missing required structure: ${snippet}`)
  }
  const requireAll = (source, snippets) => {
    for (const [snippet, code] of snippets) requireSnippet(source, snippet, code)
  }

  const { tabs, visibleText: tabText } = readTabInventory(settings)
  const visibleText = [
    ...tabText,
    ...collectVisibleText(settings, 'settings.tsx'),
    ...collectVisibleText(media, 'media-library.tsx'),
  ]
  const actualIds = tabs.map((tab) => tab.id)
  const expectedIds = CANONICAL_TABS.map(([id]) => id)
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    errors.push(`[TAB_IDS] Expected exactly ${expectedIds.length} ordered tabs: ${expectedIds.join(', ')}`)
  }
  for (let index = 0; index < CANONICAL_TABS.length; index += 1) {
    const [id, label, fields] = CANONICAL_TABS[index]
    const actual = tabs[index]
    if (!actual || actual.id !== id) continue
    if (actual.label !== label) errors.push(`[TAB_LABEL:${id}] Expected visible label ${label}`)
    const expectedFields = fields.map((field) => field.join('|'))
    const actualFields = actual.fields.map((field) => field.signature)
    if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
      errors.push(`[FIELDS:${id}] Setting type/name/kind inventory changed`)
    }
    for (const field of actual.fields) {
      if (!field.label.trim()) errors.push(`[FIELD_LABEL:${id}] Every field needs an explicit visible label`)
    }
  }

  const forbidden = ['Streamit', 'IMDb', 'rating', 'ratings', 'star', 'stars', 'review', 'reviews']
  for (const [file, source] of [['settings', settings], ['media', media]]) {
    for (const term of forbidden) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(source)) errors.push(`[VISIBLE_VOCABULARY] ${file} contains forbidden term ${term}`)
    }
  }
  for (const term of ['movie', 'movies', 'actor', 'actors', 'director', 'directors']) {
    if (visibleText.some((text) => new RegExp(`\\b${term}\\b`, 'i').test(text))) {
      errors.push(`[VISIBLE_VOCABULARY] Settings labels contain legacy content term ${term}`)
    }
  }

  requireAll(settings, [
    ["loader: async () => ({ groups: await adminGetSettings(), currencies: await adminListCurrencies() })", 'SETTINGS_LOADER'],
    ["await adminSaveSetting({ data: { id: row.id, val: values[key] } })", 'SETTINGS_SAVE'],
    ["await adminUpsertSetting({ data: { type: f.type, name: f.name, val: values[key] } })", 'SETTINGS_UPSERT'],
    ["form.append('file', file)", 'SETTINGS_UPLOAD'],
    ["fetch('/api/upload', { method: 'POST', body: form })", 'SETTINGS_UPLOAD'],
    ['src={img(cur)}', 'SETTINGS_PREVIEW'],
    ['const res = await adminTestNovu()', 'SETTINGS_NOVU'],
    ['res.workflows !== undefined', 'SETTINGS_NOVU'],
    ['currencies.map((currency)', 'SETTINGS_CURRENCY'],
    ['role="tablist"', 'SETTINGS_TABS_A11Y'],
    ['role="tab"', 'SETTINGS_TABS_A11Y'],
    ['role="tabpanel"', 'SETTINGS_TABS_A11Y'],
    ['aria-selected={selected}', 'SETTINGS_TABS_A11Y'],
    ['aria-controls="settings-active-panel"', 'SETTINGS_TABS_A11Y'],
    ['id="settings-active-panel"', 'SETTINGS_TABS_A11Y'],
    ['aria-labelledby={`settings-tab-${active.id}`}', 'SETTINGS_TABS_A11Y'],
    ['tabIndex={selected ? 0 : -1}', 'SETTINGS_TABS_A11Y'],
    ["event.key === 'ArrowRight'", 'SETTINGS_TABS_KEYBOARD'],
    ["event.key === 'ArrowLeft'", 'SETTINGS_TABS_KEYBOARD'],
    ["event.key === 'ArrowUp'", 'SETTINGS_TABS_KEYBOARD'],
    ["event.key === 'ArrowDown'", 'SETTINGS_TABS_KEYBOARD'],
    ["event.key === 'Home'", 'SETTINGS_TABS_KEYBOARD'],
    ["event.key === 'End'", 'SETTINGS_TABS_KEYBOARD'],
    ['role="switch"', 'SETTINGS_SWITCH_A11Y'],
    ['aria-checked={enabled}', 'SETTINGS_SWITCH_A11Y'],
    ['aria-labelledby={labelId}', 'SETTINGS_SWITCH_A11Y'],
    ['htmlFor={inputId}', 'SETTINGS_LABELS'],
    ['aria-busy={busy}', 'SETTINGS_BUSY'],
    ['disabled={busy || activeDirtyCount === 0 || uploadingKey !== null}', 'SETTINGS_BUSY'],
    ['role="alert"', 'SETTINGS_ERRORS'],
    ['role="status"', 'SETTINGS_FEEDBACK'],
    ['grid-cols-1 gap-4 md:grid-cols-2', 'SETTINGS_RESPONSIVE'],
    ['overflow-x-auto', 'SETTINGS_OVERFLOW'],
    ['min-w-0', 'SETTINGS_OVERFLOW'],
    ['Sermons, Shows, Teachings, Videos, Personalities, and Locations', 'VISIBLE_VOCABULARY'],
    ['label: \'Sermons Module\'', 'VISIBLE_VOCABULARY'],
    ['label: \'Shows Module\'', 'VISIBLE_VOCABULARY'],
    ['label: \'Videos Module\'', 'VISIBLE_VOCABULARY'],
  ])

  requireAll(media, [
    ['loader: async () => await adminListR2Media()', 'MEDIA_LOADER'],
    ['<FileUploadCard', 'MEDIA_UPLOAD'],
    ['onFilesChange={startUploads}', 'MEDIA_UPLOAD'],
    ['onFileRemove={removeUpload}', 'MEDIA_UPLOAD'],
    ["form.append('file', file)", 'MEDIA_UPLOAD'],
    ["xhr.open('POST', '/api/upload')", 'MEDIA_UPLOAD'],
    ['xhr.upload.onprogress', 'MEDIA_UPLOAD'],
    ['await navigator.clipboard.writeText(`${location.origin}${url}`)', 'MEDIA_COPY'],
    ['await adminDeleteR2Object({ data: object.key })', 'MEDIA_DELETE'],
    ['title: `Delete ${object.key}?`', 'MEDIA_DELETE'],
    ['approveLabel: \'Delete\'', 'MEDIA_DELETE'],
    ['await router.invalidate()', 'MEDIA_REFRESH'],
    ['src={object.url}', 'MEDIA_PREVIEW'],
    ['object-contain', 'MEDIA_PREVIEW'],
    ['loading="lazy"', 'MEDIA_PREVIEW'],
    ['target="_blank"', 'MEDIA_PREVIEW'],
    ['data?.ok === false', 'MEDIA_ERRORS'],
    ['data?.truncated', 'MEDIA_FEEDBACK'],
    ['objects.length === 0', 'MEDIA_EMPTY'],
    ['No matching files', 'MEDIA_EMPTY'],
    ['No files in storage yet', 'MEDIA_EMPTY'],
    ['type="search"', 'MEDIA_SEARCH'],
    ['htmlFor="media-search"', 'MEDIA_LABELS'],
    ['aria-label="Clear media search"', 'MEDIA_ICON_NAMES'],
    ['inline-flex size-11 -translate-y-1/2', 'MEDIA_TOUCH_TARGETS'],
    ['aria-label={`Open ${object.key} in a new tab`}', 'MEDIA_ICON_NAMES'],
    ['aria-busy={deleting}', 'MEDIA_BUSY'],
    ['disabled={deletingKey !== null}', 'MEDIA_BUSY'],
    ['disabled={deletingKey !== null || copyingKey !== null}', 'MEDIA_BUSY'],
    ['role="alert"', 'MEDIA_ERRORS'],
    ['role="status"', 'MEDIA_FEEDBACK'],
    ['grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3', 'MEDIA_RESPONSIVE'],
    ['min-w-0', 'MEDIA_OVERFLOW'],
  ])
  requireSnippet(styles, ':focus-visible', 'FOCUS_VISIBILITY')
  requireSnippet(styles, '@media (prefers-reduced-motion: reduce)', 'REDUCED_MOTION')

  return errors
}

function runSelfTest() {
  const settings = readFileSync(settingsPath, 'utf8')
  const media = readFileSync(mediaPath, 'utf8')
  const styles = readFileSync(stylesPath, 'utf8')
  const baselineErrors = verifySources(settings, media, styles)
  if (baselineErrors.length > 0) throw new Error(`Positive control failed:\n${baselineErrors.join('\n')}`)

  const cases = [
    ['missing tab', { settings: settings.replace("id: 'business'", "id: 'business-removed'") }, 'TAB_IDS'],
    ['renamed stored key', { settings: settings.replace("name: 'movie'", "name: 'removed_movie'") }, 'FIELDS:module'],
    ['removed Novu integration', { settings: settings.replace('await adminTestNovu()', 'await missingNovu()') }, 'SETTINGS_NOVU'],
    ['broken tab semantics', { settings: settings.replace('role="tablist"', 'role="navigation"') }, 'SETTINGS_TABS_A11Y'],
    ['desktop-only settings form', { settings: settings.replace('grid-cols-1 gap-4 md:grid-cols-2', 'grid-cols-2') }, 'SETTINGS_RESPONSIVE'],
    ['legacy visible label', { settings: settings.replace("label: 'Business Settings'", "label: 'Streamit Business Settings'") }, 'VISIBLE_VOCABULARY'],
    ['legacy JSX heading', { media: media.replace('>Media Library</h1>', '>Movies</h1>') }, 'VISIBLE_VOCABULARY'],
    ['changed upload endpoint', { media: media.replace("xhr.open('POST', '/api/upload')", "xhr.open('POST', '/api/removed')") }, 'MEDIA_UPLOAD'],
    ['removed clipboard integration', { media: media.replace('navigator.clipboard.writeText', 'navigator.missingClipboard.writeText') }, 'MEDIA_COPY'],
    ['removed deletion integration', { media: media.replace('adminDeleteR2Object({ data: object.key })', 'missingDelete({ data: object.key })') }, 'MEDIA_DELETE'],
    ['desktop-only media grid', { media: media.replace('grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3', 'grid-cols-3') }, 'MEDIA_RESPONSIVE'],
    ['removed reduced-motion handling', { styles: styles.replace('@media (prefers-reduced-motion: reduce)', '@media (motion-removed)') }, 'REDUCED_MOTION'],
  ]

  for (const [name, overrides, expectedCode] of cases) {
    const errors = verifySources(overrides.settings ?? settings, overrides.media ?? media, overrides.styles ?? styles)
    if (!errors.some((error) => error.includes(expectedCode))) {
      throw new Error(`Self-test defect was not rejected decisively: ${name}; expected ${expectedCode}`)
    }
  }
  return cases.length
}

try {
  if (process.argv.includes('--self-test')) {
    const count = runSelfTest()
    console.log(`SETTINGS_MEDIA_SELF_TEST_OK ${count} defects rejected`)
  } else {
    const errors = verifySources(
      readFileSync(settingsPath, 'utf8'),
      readFileSync(mediaPath, 'utf8'),
      readFileSync(stylesPath, 'utf8'),
    )
    if (errors.length > 0) {
      console.error(errors.join('\n'))
      process.exitCode = 1
    } else {
      console.log('SETTINGS_MEDIA_OK')
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
