import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const paths = {
  table: 'src/components/AdminDataTable.tsx',
  crud: 'src/components/CrudTable.tsx',
  content: 'src/components/admin-content.tsx',
  series: 'src/components/SeriesAdmin.tsx',
  poster: 'src/components/Poster.tsx',
  confirm: 'src/lib/confirm.tsx',
  toast: 'src/lib/toast.tsx',
  fields: 'src/lib/crud-fields.ts',
  approval: 'src/components/ui/approval-card.tsx',
  notification: 'src/components/ui/halo-notification.tsx',
  progress: 'src/components/ui/progress.tsx',
  upload: 'src/components/ui/file-upload-card.tsx',
  sharedTable: 'src/components/ui/table.tsx',
  dropdown: 'src/components/ui/dropdown-menu.tsx',
  pagination: 'src/components/ui/datatable-1-utils/datatable-1-pagination.tsx',
}

function loadSources() {
  return new Map(Object.entries(paths).map(([name, path]) => [name, readFileSync(join(root, path), 'utf8')]))
}

function verify(sources) {
  const failures = []
  const source = (name) => {
    const value = sources.get(name)
    if (typeof value !== 'string') throw new Error(`Missing source: ${name}`)
    return value
  }
  const expect = (name, pattern, message) => {
    const value = source(name)
    const matches = typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value)
    if (!matches) failures.push(`${name}: ${message}`)
  }
  const reject = (name, pattern, message) => {
    const value = source(name)
    const matches = typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value)
    if (matches) failures.push(`${name}: ${message}`)
  }

  // Generic CRUD server calls, payload keys, uploads, invalidation, and dependent fields.
  for (const call of ['adminGetRow', 'adminUpsertRow', 'adminDeleteRow']) {
    expect('crud', new RegExp(`\\b${call}\\b`), `must retain ${call}`)
  }
  expect('crud', "fetch('/api/upload', { method: 'POST', body: form })", 'must retain the R2 upload request')
  expect('crud', 'values[field.key] = value', 'must build payloads from declared field keys')
  expect('crud', 'data: { entity, id: editing.id, values }', 'must retain entity/id/value upsert payloads')
  expect('crud', 'data: { entity, id }', 'must retain entity/id delete payloads')
  expect('crud', 'router.invalidate()', 'must invalidate the router after CRUD changes')
  expect('crud', 'changeField(fields, editing, field.key', 'must clear invalid dependent selections when parents change')
  expect('crud', 'fieldOptions(field, editing)', 'must derive options from the current parent')
  expect('crud', 'Select ${parentLabel} first', 'must explain why a dependent selector is disabled')
  expect('fields', 'option.parentValue', 'must retain parentValue option grouping')
  expect('fields', "field.dependsOn === key", 'must retain dependent reset semantics')
  expect('crud', /finally\s*\{[\s\S]*?setUploading/, 'upload busy state must always clear')

  // Content CRUD, all five tabs, R2, Bunny metadata, and router behavior.
  for (const call of ['adminUpsertContent', 'adminDeleteContent', 'adminGetContent', 'adminContentOptions']) {
    expect('content', new RegExp(`\\b${call}\\b`), `must retain ${call}`)
  }
  expect('content', "fetch('/api/upload', { method: 'POST', body: form })", 'must retain R2 image/subtitle uploads')
  expect('content', "fetch('/api/bunny-upload', { method: 'POST', body: form })", 'must retain Bunny Stream uploads')
  expect('content', "form.append('table', 'entertainments')", 'must retain Bunny entertainment mapping')
  expect('content', "form.append('row_id', String(contentId))", 'must retain Bunny row mapping')
  expect('content', "form.append('title', title || file.name)", 'must retain Bunny titles')
  expect('content', 'data: { ...editing, type }', 'must preserve stored fields in content save payloads')
  expect('content', 'router.invalidate()', 'must invalidate content routes after changes')
  for (const tab of ['general', 'media', 'pricing', 'seo', 'cast']) {
    expect('content', `key: '${tab}'`, `must retain the ${tab} editor tab`)
    expect('content', `id=\"content-panel-${tab}\"`, `must expose the ${tab} tab panel`)
  }
  const contentFields = [
    'name', 'short_description', 'description', 'release_date', 'language', 'duration', 'status', 'is_restricted',
    'bunny_video_url', 'bunny_trailer_url', 'trailer_url', 'video_url_input', 'enable_quality', 'poster_url',
    'thumbnail_url', 'enable_subtitle', 'subtitle_language', 'subtitle_file', 'movie_access', 'plan_id', 'price',
    'discount', 'purchase_type', 'access_duration', 'available_for', 'meta_title', 'meta_keywords',
    'meta_description', 'seo_image', 'genre_ids', 'cast_ids', 'director_ids',
  ]
  for (const field of contentFields) {
    expect('content', new RegExp(`editing\\.${field}\\b`), `must retain the ${field} workflow`)
  }
  expect('content', "content_rating: '', IMDb_rating: ''", 'must retain stored compatibility values without rendering their inputs')
  expect('content', /onBusyChange\?\.\(true\)/, 'must mark uploads busy at start')
  expect('content', /finally\s*\{[\s\S]*?onBusyChange\?\.\(false\)[\s\S]*?input\.value = ''/, 'must clear upload busy state and file input')

  // Current public vocabulary and dependent parent grouping.
  expect('content', "type === 'teaching' ? 'Teachings' : title", 'must display Teachings in plural')
  expect('content', "movie: 'Sermon', tvshow: 'Show', teaching: 'Teaching'", 'must retain Sermon/Show/Teaching singular labels')
  expect('content', "{ key: 'cast', label: 'Personalities & Genres' }", 'must use the Personalities editor tab label while retaining the cast panel key')
  expect('content', '<ChoiceGroup label="Personalities">', 'must label cast choices as Personalities')
  expect('content', '<ChoiceGroup label="Locations">', 'must label stored director choices as Locations')
  reject('content', /label="(?:Directors|Cast \(actors\))"|aria-label="(?:Directors|Cast actors)"|No (?:directors|actors) are available|Loading genres and cast/, 'must not render legacy Cast, actor, or Directors labels')
  expect('series', "label: teaching ? 'Teachings' : 'Show'", 'must label SeriesAdmin parents Show or Teachings')
  expect('series', "group={teaching ? 'Teachings' : 'Shows'}", 'must use the current SeriesAdmin group labels')
  expect('series', "entity={teaching ? 'teaching-volumes' : 'series'}", 'must retain internal grouped entity keys')
  reject('series', "'TV Show'", 'must not render legacy TV Show labels')

  // Rating data may remain in payloads, but no owned surface may render reviews/stars/IMDb UI.
  for (const name of ['table', 'content', 'poster']) {
    reject(name, /IconStar|ratingOf|p-rating|★|☆/, 'must not render rating icons or stars')
    reject(name, /IMDb rating|\(IMDb\)|label:\s*['"]Rating['"]|label=\"Content rating\"/, 'must not render visible rating labels')
  }
  expect('table', 'columns.filter((column) => !isRatingColumn(column))', 'must filter legacy route rating columns')
  expect('table', "case 'stars':", 'must remain type-compatible with legacy star columns')
  expect('poster', 'export function img(', 'must retain the shared image resolver')

  // Shared table: local overflow, stable selection, accessible menus, responsive pagination, and empty states.
  expect('table', '<Table className=', 'must use the shared locally scrolling Table')
  expect('sharedTable', /overflow-x-auto/, 'shared Table must own horizontal overflow')
  expect('sharedTable', 'role="region"', 'shared Table scroller must be a named region')
  expect('dropdown', '<DropdownMenuPrimitive.Portal>', 'action menus must portal out of table overflow')
  expect('pagination', 'flex-wrap', 'pagination must wrap on narrow screens')
  expect('table', 'WeakMap<object, string>', 'rows without IDs need stable object identities')
  expect('table', 'Array.from(new Set([...current, ...pageIds]))', 'page selection must not clear other pages')
  expect('table', "'indeterminate'", 'page selection must expose a mixed state')
  expect('table', 'aria-label="Clear search"', 'search must have a named clear control')
  expect('table', 'No matching records', 'filtered empty state must be meaningful')
  expect('table', 'aria-label={`Actions for ${rowName}`}', 'row action menus need record-specific names')

  // Native dialog naming, initial focus, focus return, Escape/backdrop behavior, and busy containment.
  for (const name of ['crud', 'content', 'confirm']) {
    expect(name, '<dialog', 'must use a native dialog')
    expect(name, 'dialog.showModal()', 'must open with showModal()')
    expect(name, 'dialog.close()', 'must close the native dialog during cleanup')
    expect(name, 'previousFocus', 'must capture the invoking control')
    expect(name, 'previousFocus.focus()', 'must return focus to the invoking control')
    expect(name, 'onCancel=', 'must handle native Escape cancellation')
    expect(name, 'event.preventDefault()', 'must control Escape behavior')
    expect(name, 'getBoundingClientRect()', 'must distinguish backdrop clicks from dialog content')
    expect(name, 'aria-labelledby=', 'must expose an accessible dialog title')
  }
  for (const name of ['crud', 'content']) {
    expect(name, 'data-initial-focus', 'must deliberately place initial editor focus')
    expect(name, 'aria-busy={isBusy}', 'must expose editor busy state')
    expect(name, 'disabled={isBusy}', 'must prevent save/close while busy')
    expect(name, 'noValidate', 'must retain existing custom required-field validation')
    expect(name, 'type=\"submit\"', 'must support explicit form submission')
  }
  expect('content', 'role="tablist"', 'must expose the five tabs as a tab list')
  expect('content', "event.key === 'ArrowRight'", 'must support keyboard tab navigation')
  expect('content', 'type=\"button\"', 'upload/tab/action buttons must not accidentally submit the form')
  expect('crud', 'aria-label={`Upload ${field.label}`}', 'generic file inputs need field-specific labels')
  expect('crud', 'alt={`${field.label} preview`}', 'generic image previews need useful alternative text')
  expect('content', 'aria-label=\"Choose video file for Bunny Stream\"', 'Bunny file input needs an accessible name')
  expect('confirm', 'data-confirm-cancel', 'confirmation must focus the safe action initially')

  // Feedback and upload primitives.
  expect('notification', 'role={politeness === \'alert\' ? \'alert\' : \'status\'}', 'toasts must use appropriate live-region roles')
  expect('notification', 'aria-label=\"Dismiss notification\"', 'toast dismissal needs an accessible name')
  expect('toast', 'TOAST_TTL_MS', 'must retain automatic toast dismissal')
  expect('toast', 'clearTimeout', 'must clean up toast timers')
  expect('approval', 'aria-labelledby={labelledBy}', 'approval content must be named')
  expect('progress', 'ProgressPrimitive.Root', 'must retain progressbar semantics')
  expect('progress', 'aria-valuetext=', 'progress must expose a readable value')
  expect('upload', 'aria-label=\"Choose files to upload\"', 'file picker needs an accessible name')
  expect('upload', 'aria-label=\"Close upload panel\"', 'close control needs an accessible name')
  expect('upload', 'aria-label={busy ? `Cancel upload of ${file.file.name}`', 'busy upload removal must be named as cancellation')
  expect('upload', 'aria-label={`Upload progress for ${file.file.name}`}', 'each upload needs a named progressbar')
  expect('upload', 'onDrop={handleDrop}', 'must retain drag-and-drop uploads')
  expect('upload', 'onFilesChange(selectedFiles)', 'must retain file selection callbacks')
  expect('upload', 'onFileRemove(file.id)', 'must retain removal/cancellation callbacks')

  if (failures.length) {
    throw new Error(`CRUD component verification failed:\n- ${failures.join('\n- ')}`)
  }
}

const sources = loadSources()
const selfTest = process.argv.includes('--self-test')

if (selfTest) {
  verify(sources)
  const negativeControls = [
    {
      name: 'crud',
      before: "fetch('/api/upload'",
      after: "fetch('/api/removed-upload'",
      failure: 'R2 upload request',
    },
    {
      name: 'content',
      before: '<ChoiceGroup label="Locations">',
      after: '<ChoiceGroup label="Places">',
      failure: 'stored director choices as Locations',
    },
    {
      name: 'content',
      before: '<ChoiceGroup label="Locations">',
      after: '<ChoiceGroup label="Directors">',
      failure: 'legacy Cast, actor, or Directors labels',
    },
  ]
  for (const control of negativeControls) {
    const broken = new Map(sources)
    broken.set(control.name, sources.get(control.name).replace(control.before, control.after))
    let rejected = false
    try {
      verify(broken)
    } catch (error) {
      rejected = error instanceof Error && error.message.includes(control.failure)
    }
    if (!rejected) throw new Error(`Negative control was not rejected: ${control.failure}`)
  }
  console.log('CRUD_COMPONENTS_SELF_TEST_OK')
} else {
  verify(sources)
  console.log('CRUD_COMPONENTS_OK')
}
