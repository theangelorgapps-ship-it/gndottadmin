import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Check, CircleAlert, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { bulkImportContext, bulkImportRows } from '../../lib/bulk-import'
import {
  autoMapHeaders, parseBulkRows, HEADER_ALIASES,
  type BulkField, type BulkResult, type BulkRow,
} from '../../lib/bulk-import-core'
import { useToast } from '../../lib/toast'
import { Button } from '../../components/ui/button'

export const Route = createFileRoute('/admin/bulk-upload')({
  loader: async () => await bulkImportContext(),
  component: AdminBulkUpload,
})

const FIELDS: { value: BulkField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'destination', label: 'Destination' },
  { value: 'video', label: 'Video (Dropbox link or Bunny ID)' },
  { value: 'series', label: 'Series' },
  { value: 'season', label: 'Season / Volume' },
  { value: 'categories', label: 'Categories' },
  { value: 'preacher', label: 'Preacher' },
  { value: 'location', label: 'Location' },
  { value: 'description', label: 'Description' },
  { value: 'releaseDate', label: 'Release Date' },
  { value: 'access', label: 'Access' },
]

const TEMPLATE_HEADERS = ['Title', 'Destination', 'Video', 'Series', 'Season', 'Categories', 'Preacher', 'Location', 'Description', 'Release Date', 'Access']
const TEMPLATE_EXAMPLES = [
  ['Easter Sunday 2026', 'Sermon', 'https://www.dropbox.com/s/abc123/easter.mp4?dl=0', '', '', 'Faith, Easter', 'Rev. Adams', 'London', 'The resurrection hope.', '2026-04-05', 'free'],
  ['Romans Lesson 1', 'Teaching', '0443f5a5-de41-4536-b212-b15272a3cf86', 'Book of Romans', 'Volume 1', 'Doctrine', 'Rev. Adams', 'London', 'Introduction to Romans.', '2026-01-12', 'free'],
]

const OUTCOME_LABEL: Record<BulkResult['outcome'], string> = {
  queued: 'Queued for transcoding',
  attached: 'Attached',
  'skipped-duplicate': 'Skipped (duplicate)',
  failed: 'Failed',
}

function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES])
  sheet['!cols'] = TEMPLATE_HEADERS.map(header => ({ wch: Math.max(16, header.length + 4) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Bulk Upload')
  XLSX.writeFile(book, 'halobox-bulk-upload-template.xlsx')
}

function AdminBulkUpload() {
  const context = Route.useLoaderData()
  const router = useRouter()
  const notify = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [matrix, setMatrix] = useState<unknown[][]>([])
  const [mapping, setMapping] = useState<(BulkField | null)[]>([])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BulkResult[] | null>(null)

  const rows = useMemo<BulkRow[]>(() => matrix.length ? parseBulkRows(matrix, mapping) : [], [matrix, mapping])
  const existing = useMemo(() => ({
    genre: new Set(context.genres.map((n: string) => n.toLowerCase())),
    preacher: new Set(context.preachers.map((n: string) => n.toLowerCase())),
    location: new Set(context.locations.map((n: string) => n.toLowerCase())),
  }), [context])

  const newNames = useMemo(() => {
    const found = new Set<string>()
    for (const row of rows) {
      for (const name of row.categories) if (!existing.genre.has(name.toLowerCase())) found.add(`Category: ${name}`)
      for (const name of row.preachers) if (!existing.preacher.has(name.toLowerCase())) found.add(`Preacher: ${name}`)
      for (const name of row.locations) if (!existing.location.has(name.toLowerCase())) found.add(`Location: ${name}`)
      if (row.series) found.add(`Series/season if missing: ${row.series}`)
    }
    return [...found]
  }, [rows, existing])

  const validRows = rows.filter(row => row.errors.length === 0)
  const errorRows = rows.filter(row => row.errors.length > 0)

  async function readFile(file: File) {
    setResults(null)
    try {
      const book = XLSX.read(await file.arrayBuffer())
      const sheet = book.Sheets[book.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
      const [head, ...body] = grid
      const headerRow = (head ?? []).map(cell => String(cell ?? ''))
      setHeaders(headerRow)
      setMapping(autoMapHeaders(headerRow))
      setMatrix(body)
      setFileName(file.name)
    } catch {
      notify({ title: 'Could not read the file', description: 'Upload an .xlsx, .xls or .csv file.', variant: 'destructive' })
    }
  }

  function setColumnField(column: number, field: string) {
    setMapping(current => current.map((value, index) => (index === column ? (field || null) as BulkField | null : value)))
  }

  async function importNow() {
    if (busy || !validRows.length) return
    setBusy(true)
    try {
      const { results: outcome, summary } = await bulkImportRows({ data: { rows: validRows } })
      setResults(outcome)
      notify({
        title: 'Bulk import finished',
        description: `${summary.queued} queued, ${summary.attached} attached, ${summary.skipped} skipped, ${summary.failed} failed.`,
        variant: summary.failed ? 'destructive' : 'success',
      })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Import failed', description: e?.message ?? 'Could not import the rows.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Bulk Upload</span></div>
      <div className="toolbar">
        <span className="spacer" />
        <button type="button" className="btn btn-dark" onClick={downloadTemplate}>
          <Download size={14} aria-hidden="true" /> Download template
        </button>
      </div>

      <div className="mb-6 rounded-[14px] border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-accent" aria-hidden="true">
            <FileSpreadsheet className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Upload spreadsheet</h2>
            <p className="text-sm text-muted-foreground">.xlsx, .xls or .csv — headers are matched automatically, and you can remap any column below.</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          aria-label="Choose spreadsheet to import"
          onChange={event => {
            const file = event.currentTarget.files?.[0]
            if (file) void readFile(file)
            event.currentTarget.value = ''
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
          <Upload size={14} aria-hidden="true" /> {fileName ? 'Choose another file' : 'Choose file'}
        </button>
        {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="mb-4 rounded-[14px] border border-border bg-card p-5 sm:p-6">
            <h2 className="mb-1 text-base font-semibold text-foreground">Column mapping</h2>
            <p className="mb-4 text-sm text-muted-foreground">Auto-matched from your headers — change any column or set it to Ignore.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((header, column) => (
                <div className="mfield" key={column}>
                  <label htmlFor={`bulk-map-${column}`} className="truncate">{headers[column] || `Column ${column + 1}`}</label>
                  <select
                    id={`bulk-map-${column}`}
                    value={mapping[column] ?? ''}
                    onChange={event => setColumnField(column, event.target.value)}
                  >
                    <option value="">Ignore</option>
                    {FIELDS.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-[14px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-foreground">Preview</h2>
              <span className="text-xs text-muted-foreground">{validRows.length} ready · {errorRows.length} with errors</span>
            </div>
            {newNames.length > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                Will be created: {newNames.join(' · ')}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2">Row</th>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Destination</th>
                    <th className="px-2 py-2">Video</th>
                    <th className="px-2 py-2">Series / Season</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.index} className="border-b border-border/60 align-top">
                      <td className="px-2 py-2 text-muted-foreground">{row.index}</td>
                      <td className="max-w-56 break-words px-2 py-2 font-medium text-foreground">{row.title || '—'}</td>
                      <td className="px-2 py-2 capitalize">{row.destination ?? '—'}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{row.video.kind === 'dropbox' ? 'Dropbox → Bunny' : row.video.kind === 'bunny' ? 'Bunny ID' : '—'}</td>
                      <td className="max-w-44 break-words px-2 py-2 text-xs text-muted-foreground">{[row.series, row.season].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="max-w-64 px-2 py-2">
                        {row.errors.map(error => (
                          <div key={error} className="mb-1 flex items-start gap-1 text-xs text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{error}</div>
                        ))}
                        {row.warnings.map(warning => (
                          <div key={warning} className="mb-1 text-xs text-muted-foreground">{warning}</div>
                        ))}
                        {row.errors.length === 0 && <span className="pill on">Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="btn btn-primary" disabled={busy || validRows.length === 0} onClick={() => void importNow()}>
                {busy ? 'Importing…' : `Import ${validRows.length} ${validRows.length === 1 ? 'row' : 'rows'}`}
              </button>
              {errorRows.length > 0 && <span className="text-xs text-muted-foreground">Rows with errors are skipped.</span>}
            </div>
          </div>
        </>
      )}

      {results && (
        <div className="rounded-[14px] border border-border bg-card p-5 sm:p-6" aria-live="polite">
          <h2 className="mb-3 text-base font-semibold text-foreground">Import results</h2>
          <ul className="space-y-2">
            {results.map(result => (
              <li key={result.index} className="flex flex-wrap items-center gap-2 text-sm">
                {result.outcome === 'failed'
                  ? <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  : <Check className="size-4 shrink-0 text-[var(--success)]" aria-hidden="true" />}
                <span className="font-medium text-foreground">{result.title || `Row ${result.index}`}</span>
                <span className={`pill ${result.outcome === 'failed' ? 'off' : result.outcome === 'skipped-duplicate' ? 'info' : 'on'}`}>
                  {OUTCOME_LABEL[result.outcome]}
                </span>
                {result.error && <span className="text-xs text-destructive">{result.error}</span>}
                {result.createdNames.length > 0 && <span className="text-xs text-muted-foreground">created: {result.createdNames.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
