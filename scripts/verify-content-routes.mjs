import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const episodeFields = [
  'name', 'episode_number', 'entertainment_id', 'season_id', 'duration', 'release_date',
  'poster_url', 'bunny_video_url', 'video_url_input', 'access', 'price', 'status',
  'short_desc', 'description',
]
const personalityFields = ['name', 'designation', 'file_url', 'dob', 'place_of_birth', 'status', 'bio']
const customDialogHooks = [
  '<dialog', 'dialog.showModal()', 'dialog.close()', 'previousFocus', 'previousFocus.focus()',
  'aria-labelledby=', 'aria-describedby=', 'onCancel=', 'getBoundingClientRect()',
  'data-initial-focus', 'noValidate', 'type="submit"', 'role="alert"',
]

const routes = {
  genres: {
    file: 'src/routes/admin/genres.tsx', url: '/admin/genres', system: 'AdminDataTable', formType: 'GForm',
    fields: ['id', 'name', 'status'],
    hooks: ['adminListGenres()', 'adminUpsertGenre({ data: editing })', 'adminDeleteGenre({ data: id })', ...customDialogHooks],
    labels: ['<span className="here">Genres</span>', '+ New Genre', 'searchPlaceholder="Search genres…"'],
  },
  movies: {
    file: 'src/routes/admin/movies.tsx', url: '/admin/movies', system: 'ContentAdmin',
    hooks: ["adminListContent({ data: 'movie' })"],
    labels: ['type="movie" title="Sermons"'],
  },
  'tv-shows': {
    file: 'src/routes/admin/tv-shows.tsx', url: '/admin/tv-shows', system: 'ContentAdmin',
    hooks: ["adminListContent({ data: 'tvshow' })"],
    labels: ['type="tvshow" title="Shows"'],
  },
  series: {
    file: 'src/routes/admin/series.tsx', url: '/admin/series', system: 'SeriesAdmin',
    hooks: ["adminTable({ data: 'series' })", 'adminOptions()'],
    labels: ['<SeriesAdmin type="tvshow" rows={rows} parents={options.shows} />'],
  },
  episodes: {
    file: 'src/routes/admin/episodes.tsx', url: '/admin/episodes', system: 'CrudTable', fields: episodeFields,
    hooks: ["adminTable({ data: 'episodes' })", 'adminOptions()', 'entity="episodes"'],
    labels: ['title="Episodes" group="Shows"', "label: 'Show'", "label: 'Name of the Series'"],
    snippets: [
      "dependsOn: 'entertainment_id'", "s.type === 'tvshow'", 'parentValue: s.entertainment_id',
      'options.shows.map', 'options.seasons.filter',
    ],
  },
  teaching: {
    file: 'src/routes/admin/teaching.tsx', url: '/admin/teaching', system: 'ContentAdmin',
    hooks: ["adminListContent({ data: 'teaching' })"],
    labels: ['type="teaching" title="Teachings"'],
  },
  'teaching-volumes': {
    file: 'src/routes/admin/teaching-volumes.tsx', url: '/admin/teaching-volumes', system: 'SeriesAdmin',
    hooks: ["adminTable({ data: 'teaching-volumes' })", 'adminOptions()'],
    labels: ['<SeriesAdmin type="teaching" rows={rows} parents={options.teaching} />'],
  },
  'teaching-episodes': {
    file: 'src/routes/admin/teaching-episodes.tsx', url: '/admin/teaching-episodes', system: 'CrudTable', fields: episodeFields,
    hooks: ["adminTable({ data: 'teaching-episodes' })", 'adminOptions()', 'entity="teaching-episodes"'],
    labels: ['title="Episodes" group="Teachings"', "label: 'Teaching'", "label: 'Volume (Series)'"],
    snippets: [
      "dependsOn: 'entertainment_id'", "s.type === 'teaching'", 'parentValue: s.entertainment_id',
      'options.teaching.map', 'options.seasons.filter',
    ],
  },
  videos: {
    file: 'src/routes/admin/videos.tsx', url: '/admin/videos', system: 'AdminDataTable', formType: 'VForm',
    fields: [
      'id', 'name', 'description', 'duration', 'release_date', 'status', 'poster_url', 'thumbnail_url',
      'trailer_url', 'video_url_input', 'bunny_video_url', 'access', 'price', 'enable_subtitle',
      'subtitle_file', 'subtitle_language', 'meta_title', 'meta_keywords', 'meta_description',
    ],
    hooks: [
      'adminListVideos()', 'adminGetVideo({ data: id })', 'adminUpsertVideo({ data: editing })',
      'adminDeleteVideo({ data: id })', "fetch('/api/bunny-upload', { method: 'POST', body: form })",
      "form.append('file', file)", "form.append('title', title || file.name)",
      "form.append('table', 'videos')", "form.append('row_id', String(videoId))",
      'onBusyChange(true)', 'onBusyChange(false)', ...customDialogHooks,
    ],
    labels: ['<span className="here">Videos</span>', '+ New Video', 'searchPlaceholder="Search videos…"'],
  },
  'tv-category': {
    file: 'src/routes/admin/tv-category.tsx', url: '/admin/tv-category', system: 'CrudTable',
    fields: ['name', 'file_url', 'status', 'description'],
    hooks: ["adminTable({ data: 'tv-category' })", 'entity="tv-category"'],
    labels: ['title="Categories" singular="Category" group="Live TV"'],
  },
  'live-tv': {
    file: 'src/routes/admin/live-tv.tsx', url: '/admin/live-tv', system: 'AdminDataTable', formType: 'CForm',
    fields: ['id', 'name', 'category_id', 'access', 'description', 'status'],
    hooks: [
      'adminListChannels()', 'adminUpsertChannel({', 'adminDeleteChannel({ data: id })',
      "category_id: editing.category_id === '' ? undefined : Number(editing.category_id)",
      ...customDialogHooks,
    ],
    labels: ['<span className="here">Live TV</span>', '+ New Channel', 'searchPlaceholder="Search live channels…"'],
  },
  actors: {
    file: 'src/routes/admin/actors.tsx', url: '/admin/actors', system: 'CrudTable', fields: personalityFields,
    hooks: ["adminTable({ data: 'actors' })", 'entity="actors"'],
    labels: ['title="Personalities" singular="Personality" group="Content"', "label: 'Personality'"],
  },
  directors: {
    file: 'src/routes/admin/directors.tsx', url: '/admin/directors', system: 'CrudTable', fields: personalityFields,
    hooks: ["adminTable({ data: 'directors' })", 'entity="directors"'],
    labels: ['title="Locations" singular="Location" group="Content"', "label: 'Location'"],
  },
}

// Route-local UI may retain internal entity keys, but none of these terms may be visible.
const forbiddenVisible = /\b(?:streamit|movies?|tv\s+shows?|actors?|directors?|reviews?|imdb|ratings?|stars?)\b|cast\s*&\s*crew/i
const visibleAttributes = new Set(['title', 'group', 'label', 'singular', 'empty', 'searchPlaceholder', 'placeholder', 'aria-label', 'alt', 'description'])
const visibleProperties = new Set(['label', 'title', 'description', 'placeholder', 'approveLabel', 'empty'])

function loadSources() {
  return Object.fromEntries(Object.entries(routes).map(([name, route]) => [name, readFileSync(join(root, route.file), 'utf8')]))
}

function parse(name, source) {
  return ts.createSourceFile(routes[name].file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function walk(node, visit) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

function propertyName(node) {
  if (!node) return null
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return null
}

function fieldKeys(name, source) {
  const keys = []
  walk(parse(name, source), (node) => {
    if (!ts.isJsxAttribute(node) || node.name.text !== 'fields' || !node.initializer) return
    if (!ts.isJsxExpression(node.initializer) || !node.initializer.expression) return
    const expression = node.initializer.expression
    if (!ts.isArrayLiteralExpression(expression)) return
    for (const element of expression.elements) {
      if (!ts.isObjectLiteralExpression(element)) continue
      for (const property of element.properties) {
        if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== 'key') continue
        if (ts.isStringLiteral(property.initializer)) keys.push(property.initializer.text)
      }
    }
  })
  return keys
}

function formTypeKeys(name, source, typeName) {
  let keys = null
  walk(parse(name, source), (node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== typeName || !ts.isTypeLiteralNode(node.type)) return
    keys = node.type.members.map((member) => ts.isPropertySignature(member) ? propertyName(member.name) : null).filter(Boolean)
  })
  return keys
}

function visibleText(name, source) {
  const values = []
  const literalValue = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text)
    if (ts.isTemplateExpression(node)) {
      values.push(node.head.text)
      for (const span of node.templateSpans) values.push(span.literal.text)
    }
  }
  walk(parse(name, source), (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText().replace(/\s+/g, ' ').trim()
      if (text) values.push(text)
    }
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.text) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) literalValue(node.initializer)
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) literalValue(node.initializer.expression)
    }
    if (ts.isPropertyAssignment(node) && visibleProperties.has(propertyName(node.name))) literalValue(node.initializer)
    if (node.parent && ts.isJsxExpression(node.parent)) literalValue(node)
  })
  return values
}

function sameKeys(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && [...actual].sort().every((key, index) => key === [...expected].sort()[index])
}

function verify(sources) {
  const failures = []
  const check = (condition, id) => { if (!condition) failures.push(id) }
  const names = Object.keys(routes)
  check(names.length === 13, 'manifest.route-count')
  check(new Set(names.map((name) => routes[name].url)).size === 13, 'manifest.unique-urls')
  check(new Set(names.map((name) => routes[name].file)).size === 13, 'manifest.unique-files')

  for (const name of names) {
    const route = routes[name]
    const source = sources[name]
    if (typeof source !== 'string') {
      failures.push(`${name}.missing-source`)
      continue
    }
    check(source.includes(`createFileRoute('${route.url}')`), `${name}.route-url`)
    check(source.includes(route.system), `${name}.shared-system`)
    check(source.includes('router.invalidate()') || ['movies', 'tv-shows', 'series', 'episodes', 'teaching', 'teaching-volumes', 'teaching-episodes', 'tv-category', 'actors', 'directors'].includes(name), `${name}.invalidation`)
    for (const hook of route.hooks) check(source.includes(hook), `${name}.hooks:${hook}`)
    for (const label of route.labels) check(source.includes(label), `${name}.labels:${label}`)
    for (const snippet of route.snippets ?? []) check(source.includes(snippet), `${name}.dependent-selector:${snippet}`)

    if (route.fields) {
      const actual = route.formType ? formTypeKeys(name, source, route.formType) : fieldKeys(name, source)
      check(sameKeys(actual, route.fields), `${name}.field-definitions`)
    }
    if (route.formType) {
      for (const key of route.fields) check(new RegExp(`\\bediting\\.${key}\\b`).test(source), `${name}.form-values:${key}`)
    }
    if (name === 'videos') {
      for (const key of route.fields) check(new RegExp(`\\b${key}:\\s*row\\.${key}\\b`).test(source), `${name}.payload-mapping:${key}`)
      check(!/IMDb_rating|kind:\s*['"]stars['"]/i.test(source), `${name}.review-column`)
    }

    for (const text of visibleText(name, source)) {
      check(!forbiddenVisible.test(text), `${name}.visible-vocabulary:${text}`)
    }
  }
  return failures
}

const baseline = loadSources()
const baselineFailures = verify(baseline)

if (process.argv.includes('--self-test')) {
  if (baselineFailures.length > 0) {
    console.error('Self-test requires a passing positive control.')
    for (const failure of baselineFailures) console.error(`FAIL ${failure}`)
    process.exit(1)
  }

  const negativeControls = [
    ['legacy Sermon label', 'movies', (source) => source.replace('title="Sermons"', 'title="Movies"'), 'movies.visible-vocabulary:'],
    ['removed dependent selector', 'episodes', (source) => source.replace("dependsOn: 'entertainment_id', ", ''), 'episodes.dependent-selector:'],
    ['legacy Personality label', 'actors', (source) => source.replace('title="Personalities"', 'title="Actors"'), 'actors.labels:'],
    ['removed Video payload field', 'videos', (source) => source.replace("meta_description: row.meta_description ?? '',", ''), 'videos.payload-mapping:meta_description'],
    ['removed Genre upsert', 'genres', (source) => source.replace('adminUpsertGenre({ data: editing })', 'adminUpsertGenre({ data: {} })'), 'genres.hooks:'],
    ['changed Location entity', 'directors', (source) => source.replace('entity="directors"', 'entity="locations"'), 'directors.hooks:'],
    ['restored visible Video rating', 'videos', (source) => source.replace("{ key: 'status', label: 'Status', kind: 'pill' },", "{ key: 'IMDb_rating', label: 'Rating' },\n          { key: 'status', label: 'Status', kind: 'pill' },"), 'videos.visible-vocabulary:Rating'],
  ]

  const missed = []
  for (const [description, name, mutate, expectedFailure] of negativeControls) {
    const broken = { ...baseline, [name]: mutate(baseline[name]) }
    const failures = verify(broken)
    if (!failures.some((failure) => failure.includes(expectedFailure))) {
      missed.push(`${description}: expected ${expectedFailure}`)
    } else {
      console.log(`CAUGHT ${description}`)
    }
  }
  if (missed.length > 0) {
    for (const failure of missed) console.error(`FAIL ${failure}`)
    process.exit(1)
  }
  console.log(`CONTENT_ROUTES_SELF_TEST_OK ${negativeControls.length} defects rejected`)
} else if (baselineFailures.length > 0) {
  for (const failure of baselineFailures) console.error(`FAIL ${failure}`)
  console.error(`CONTENT_ROUTES_FAILED ${baselineFailures.length} failures`)
  process.exit(1)
} else {
  console.log('CONTENT_ROUTES_OK 13 routes')
}
