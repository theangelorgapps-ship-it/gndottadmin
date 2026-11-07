import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

// Field tuples are [stored key, editor type, required]. The stored keys are the
// compatibility contract; visible labels may evolve without changing payloads.
const ROUTES = {
  'vast-ads': {
    component: 'CrudTable', entity: 'vast-ads',
    fields: [
      ['name', 'text', true], ['type', 'select'], ['url'], ['duration'], ['target_type'],
      ['enable_skip', 'toggle'], ['skip_after'], ['frequency', 'number'],
      ['start_date', 'date'], ['end_date', 'date'], ['status', 'toggle'],
    ],
    columns: ['id', 'name', 'type', 'status'],
    options: { type: ['pre-roll', 'mid-roll', 'post-roll'] },
  },
  'custom-ads': {
    component: 'CrudTable', entity: 'custom-ads',
    fields: [
      ['name', 'text', true], ['type', 'select'], ['url_type'], ['placement'], ['redirect_url'],
      ['duration'], ['skip_enabled', 'toggle'], ['skip_after'], ['status', 'toggle'],
    ],
    columns: ['id', 'name', 'type', 'status'],
    options: { type: ['image', 'video'] },
  },
  plans: { component: 'AdminDataTable', custom: true, columns: ['name', 'price', 'duration_label', 'level', 'subscribers', 'status'] },
  'plan-limits': {
    component: 'CrudTable', entity: 'plan-limits',
    fields: [['title', 'text', true], ['slug'], ['status', 'toggle'], ['description', 'textarea']],
    columns: ['title', 'slug', 'mappings', 'status'],
  },
  'rent-history': {
    component: 'AdminTablePage', readonly: true,
    columns: ['title', 'user_email', 'type_label', 'price', 'view_expiry_date', 'created_at'],
  },
  coupons: {
    component: 'CrudTable', entity: 'coupons',
    fields: [
      ['code', 'text', true], ['discount_type', 'select'], ['discount', 'number'],
      ['start_date', 'date'], ['expire_date', 'date'], ['status', 'toggle'], ['description', 'textarea'],
    ],
    columns: ['code', 'discount_type', 'discount', 'start_date', 'expire_date', 'status'],
    options: { discount_type: ['percent', 'fixed'] },
  },
  banners: {
    component: 'CrudTable', entity: 'banners',
    fields: [
      ['title'], ['type', 'select'], ['type_id', 'select'], ['banner_for', 'select'],
      ['file_url', 'image'], ['poster_url', 'image'], ['status', 'toggle'],
    ],
    columns: ['file_url', 'type_label', 'banner_for_label', 'status'],
    options: { type: ['movie', 'tvshow', 'teaching', 'video'], banner_for: ['home', 'movie', 'tv_show', 'video'] },
  },
  constants: { component: 'AdminTablePage', readonly: true, columns: ['name', 'type', 'value', 'status'] },
  'notification-templates': {
    component: 'CrudTable', entity: 'notification-templates',
    fields: [['name', 'text', true], ['label'], ['type'], ['status', 'toggle'], ['description', 'textarea']],
    columns: ['name', 'label', 'type', 'status'],
  },
  pages: {
    component: 'CrudTable', entity: 'pages',
    fields: [['name', 'text', true], ['slug'], ['status', 'toggle'], ['description', 'textarea']],
    columns: ['name', 'slug', 'status'],
  },
  onboarding: {
    component: 'CrudTable', entity: 'onboarding',
    fields: [['title', 'text', true], ['file_url', 'image'], ['status', 'toggle'], ['description', 'textarea']],
    columns: ['file_url', 'title', 'status'],
  },
  tax: {
    component: 'CrudTable', entity: 'tax',
    fields: [['title', 'text', true], ['type', 'select'], ['value', 'number'], ['status', 'toggle']],
    columns: ['title', 'type', 'value', 'status'],
    options: { type: ['percentage', 'fixed'] },
  },
  faq: {
    component: 'CrudTable', entity: 'faq',
    fields: [['question', 'text', true], ['status', 'toggle'], ['answer', 'textarea']],
    columns: ['question', 'status'],
  },
  language: {
    component: 'CrudTable', entity: 'languages',
    fields: [['key', 'text', true], ['value', 'textarea'], ['language'], ['file']],
    columns: ['key', 'value', 'language', 'file'],
  },
  world: {
    component: 'CrudTable', entity: 'worlds',
    fields: [['name', 'text', true], ['state_id', 'number'], ['status', 'toggle']],
    columns: ['name', 'state_id', 'status'],
  },
  currency: {
    component: 'CrudTable', entity: 'currencies',
    fields: [
      ['currency_name', 'text', true], ['currency_code'], ['currency_symbol'], ['is_primary', 'toggle'],
      ['currency_position'], ['no_of_decimal', 'number'], ['thousand_separator'], ['decimal_separator'],
    ],
    columns: ['currency_name', 'currency_code', 'currency_symbol', 'is_primary'],
  },
  countries: {
    component: 'CrudTable', entity: 'countries',
    fields: [
      ['name', 'text', true], ['code'], ['dial_code'], ['currency_name'], ['symbol'],
      ['currency_code'], ['status', 'toggle'],
    ],
    columns: ['name', 'code', 'dial_code', 'currency_code', 'status'],
  },
}

const FORBIDDEN_VISIBLE = [
  ['legacy-brand', /\bStreamit\b/i],
  ['review-source', /\bIMDb\b/i],
  ['rating-ui', /\bratings?\b/i],
  ['star-ui', /\bstars?\b|[★☆]/i],
  ['review-ui', /\breviews?\b/i],
  ['legacy-movie', /\bMovies?\b/],
  ['legacy-show', /\bTV Shows?\b/],
  ['legacy-actor', /\bActors?\b/],
  ['legacy-director', /\bDirectors?\b/],
]

function loadSources() {
  return Object.fromEntries(
    Object.keys(ROUTES).map((name) => [
      name,
      readFileSync(join(root, 'src', 'routes', 'admin', `${name}.tsx`), 'utf8'),
    ]),
  )
}

function scanBalanced(source, start, open, close) {
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character
      continue
    }
    if (character === open) depth += 1
    if (character === close) {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return null
}

function blockAfter(source, marker, open = '[', close = ']') {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null
  const start = source.indexOf(open, markerIndex + marker.length)
  return start < 0 ? null : scanBalanced(source, start, open, close)
}

function objectForKey(fieldsBlock, key) {
  const keyIndex = fieldsBlock.indexOf(`key: '${key}'`)
  if (keyIndex < 0) return null
  const start = fieldsBlock.lastIndexOf('{', keyIndex)
  return start < 0 ? null : scanBalanced(fieldsBlock, start, '{', '}')
}

function sameKeys(actual, expected) {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every((key) => actual.includes(key))
}

function keysIn(block) {
  return [...(block ?? '').matchAll(/\bkey:\s*'([^']+)'/g)].map((match) => match[1])
}

function verify(sources) {
  const failures = []
  const check = (id, condition) => {
    if (!condition) failures.push(id)
  }

  check('route.inventory', Object.keys(sources).length === 17 && Object.keys(ROUTES).length === 17)

  for (const [name, spec] of Object.entries(ROUTES)) {
    const source = sources[name]
    check(`${name}.source`, typeof source === 'string')
    if (typeof source !== 'string') continue

    check(`${name}.url`, source.includes(`createFileRoute('/admin/${name}')`))
    check(`${name}.shared-component`, source.includes(`../../components/${spec.component === 'AdminDataTable' ? 'AdminDataTable' : spec.component === 'CrudTable' ? 'CrudTable' : 'AdminTable'}`))
    check(`${name}.no-legacy-table`, !/<table\b|modal-back|row-actions/.test(source))

    if (spec.custom) {
      check('plans.loader', source.includes('loader: async () => await adminListPlans()'))
      for (const operation of ['adminListPlans', 'adminUpsertPlan', 'adminDeletePlan']) {
        check(`plans.operation.${operation}`, new RegExp(`\\b${operation}\\b`).test(source))
      }
      check('plans.payload', source.includes('data: {') && source.includes('...editing,') && source.includes('duration_value: durationValue') && source.includes('level,'))
      check('plans.description-preservation', source.includes("description: plan.description ?? ''"))
      for (const field of ['name', 'price', 'level', 'duration', 'duration-value', 'status', 'description']) {
        check(`plans.field.${field}`, source.includes(`id="plan-${field}"`) && source.includes(`htmlFor="plan-${field}"`))
      }
      check('plans.native-dialog', source.includes('<dialog') && source.includes('dialog.showModal()') && source.includes('dialog.close()'))
      check(
        'plans.dialog-name',
        source.includes('aria-labelledby={dialogTitleId}')
          && source.includes('aria-describedby={dialogHelpId}')
          && (source.includes('id={dialogHelpId}') || (source.includes("const dialogHelpId = 'plan-dialog-help'") && source.includes('id="plan-dialog-help"'))),
      )
      check('plans.focus', source.includes('data-initial-focus') && source.includes('previousFocus.focus()') && source.includes('[editorOpen]'))
      check('plans.escape', source.includes('onCancel={(event)') && source.includes('requestClose()'))
      check('plans.busy', source.includes('aria-busy={busy}') && source.includes('disabled={busy}') && source.includes('setBusy(false)'))
      check('plans.feedback', source.includes('role="alert"') && source.includes('empty="No subscription plans found.'))
      check('plans.responsive', source.includes('className="min-w-0"') && source.includes('modal-form') && source.includes('max-w-full overflow-y-auto'))
    } else {
      check(`${name}.loader`, source.includes(`adminTable({ data: '${spec.entity ?? name}' })`))
      check(`${name}.empty`, source.includes('empty="'))
      if (!spec.readonly) {
        check(`${name}.entity`, source.includes(`entity="${spec.entity}"`))
        check(`${name}.singular`, source.includes('singular="'))
      }
    }

    const columnsBlock = blockAfter(source, 'columns={')
    check(`${name}.columns`, sameKeys(keysIn(columnsBlock), spec.columns))

    if (spec.fields) {
      const fieldsBlock = blockAfter(source, 'fields={')
      check(`${name}.fields`, sameKeys(keysIn(fieldsBlock), spec.fields.map(([key]) => key)))
      for (const [key, type, required] of spec.fields) {
        const field = fieldsBlock ? objectForKey(fieldsBlock, key) : null
        check(`${name}.field.${key}`, Boolean(field) && field.includes('label:'))
        if (type && type !== 'text') check(`${name}.field-type.${key}`, Boolean(field?.includes(`type: '${type}'`)))
        if (required) check(`${name}.field-required.${key}`, Boolean(field?.includes('required: true')))
        for (const option of spec.options?.[key] ?? []) {
          check(`${name}.field-option.${key}.${option}`, Boolean(field?.includes(`value: '${option}'`)))
        }
      }
    }

    for (const [kind, pattern] of FORBIDDEN_VISIBLE) {
      check(`${name}.vocabulary.${kind}`, !pattern.test(source))
    }
  }

  const banners = sources.banners ?? ''
  check('banners.options-loader', banners.includes('adminOptions()'))
  check('banners.dependent-selector', banners.includes("dependsOn: 'type'") && banners.includes('parentValue: content.type'))
  check('banners.current-vocabulary', ["movie: 'Sermon'", "tvshow: 'Show'", "video: 'Video'", "tv_show: 'Shows'"].every((label) => banners.includes(label)))

  const rentals = sources['rent-history'] ?? ''
  check('rent-history.current-vocabulary', ["movie: 'Sermon'", "tvshow: 'Show'", "video: 'Video'", "episode: 'Show episode'"].every((label) => rentals.includes(label)))
  check('world.current-vocabulary', (sources.world ?? '').includes('title="Locations"') && (sources.world ?? '').includes('entity="worlds"'))

  return [...new Set(failures)]
}

function report(failures) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
}

const baseline = loadSources()
const baselineFailures = verify(baseline)

if (process.argv.includes('--self-test')) {
  if (baselineFailures.length) {
    console.error('Self-test requires a passing positive control.')
    report(baselineFailures)
    process.exit(1)
  }

  const negativeControls = [
    ['changed entity key', 'vast-ads', 'entity="vast-ads"', 'entity="other-ads"', 'vast-ads.entity'],
    ['removed form field', 'coupons', "{ key: 'description', label: 'Description', type: 'textarea' },", '', 'coupons.fields'],
    ['removed plan dialog', 'plans', 'dialog.showModal()', "dialog.setAttribute('open', '')", 'plans.native-dialog'],
    ['removed shared empty state', 'language', 'empty="No translations found.', 'data-removed="', 'language.empty'],
    ['removed banner dependency', 'banners', "dependsOn: 'type'", "dependsOn: 'missing_parent'", 'banners.dependent-selector'],
    ['restored legacy visible wording', 'banners', "{ value: 'movie', label: 'Sermon' }", "{ value: 'movie', label: 'Movie' }", 'banners.vocabulary.legacy-movie'],
    ['changed read loader', 'constants', "adminTable({ data: 'constants' })", "adminTable({ data: 'other' })", 'constants.loader'],
  ]

  const selfTestFailures = []
  for (const [name, route, before, after, expectedFailure] of negativeControls) {
    if (!baseline[route].includes(before)) {
      selfTestFailures.push(`${name}: mutation target is missing`)
      continue
    }
    const broken = { ...baseline, [route]: baseline[route].replace(before, after) }
    const failures = verify(broken)
    if (!failures.includes(expectedFailure)) selfTestFailures.push(`${name}: expected ${expectedFailure}`)
    else console.log(`CAUGHT ${name} -> ${expectedFailure}`)
  }

  if (selfTestFailures.length) {
    report(selfTestFailures)
    process.exit(1)
  }
  console.log(`SYSTEM_ROUTES_SELF_TEST_OK ${negativeControls.length} defects rejected`)
} else if (baselineFailures.length) {
  report(baselineFailures)
  process.exit(1)
} else {
  console.log(`SYSTEM_ROUTES_OK ${Object.keys(ROUTES).length} routes`)
}
