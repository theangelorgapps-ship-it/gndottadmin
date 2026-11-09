"use client"

import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Pencil, Search, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Datatable1Pagination } from './ui/datatable-1-utils/datatable-1-pagination'
import { AdminImagePreview } from './Poster'

export type DataCol = {
  key: string
  label: string
  // Keep legacy column types source-compatible; rating columns are never rendered.
  kind?: 'text' | 'title' | 'img' | 'pill' | 'money' | 'date' | 'stars' | 'access'
}

const HEAD_CLASS = 'h-12 whitespace-nowrap px-4 text-xs font-semibold text-muted-foreground'

function isRatingColumn(column: DataCol) {
  const key = column.key.toLowerCase().replace(/[^a-z0-9]/g, '')
  const label = column.label.toLowerCase().replace(/[^a-z0-9]/g, '')
  return column.kind === 'stars'
    || key === 'rating'
    || key === 'contentrating'
    || key.includes('imdbrating')
    || label === 'rating'
    || label === 'contentrating'
    || label.includes('imdbrating')
}

export function renderDataCell(r: any, c: DataCol) {
  const v = r[c.key]
  switch (c.kind) {
    case 'img':
      return (
        <div className="flex min-w-0 items-center gap-3">
          <AdminImagePreview url={v || (c.key === 'poster_url' ? r.thumbnail_url : null)} label={`${r.name ?? r.title ?? c.label} artwork`} />
          <div className="min-w-0">
            <div className="break-words font-medium text-foreground">
              {r[c.key.replace('file_url', 'name').replace('poster_url', 'name')] ?? r.name ?? ''}
            </div>
            {r.release_date ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{String(r.release_date).slice(0, 10)}</div>
            ) : null}
            {r.ingest_phase ? (
              <div className="mt-1">
                <span className="pill info">
                  {r.ingest_phase === 'transcoding' ? `Transcoding ${Math.round(Number(r.ingest_progress) || 0)}%` : 'Fetching…'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )
    case 'title':
      return <span className="break-words font-medium text-foreground">{v ?? '—'}</span>
    case 'pill':
      return <span className={`pill ${v == 1 ? 'on' : 'off'}`}>{v == 1 ? 'Active' : 'Inactive'}</span>
    case 'access':
      return <span className={`pill ${v === 'free' ? 'info' : 'on'}`}>{v === 'free' ? 'Free' : v === 'paid' ? 'Paid' : v === 'subscription' ? 'Subscription' : v || 'Not set'}</span>
    case 'money':
      return <span className="tabular-nums">${Number(v ?? 0).toFixed(2)}</span>
    case 'date':
      return <span className="whitespace-nowrap tabular-nums">{v ? String(v).slice(0, 10) : '—'}</span>
    case 'stars':
      return null
    default:
      return <span className="break-words text-muted-foreground">{v ?? '—'}</span>
  }
}

export function AdminDataTable({
  rows,
  columns,
  onEdit,
  onDelete,
  busy = false,
  searchable,
  searchPlaceholder = 'Search…',
  pageSize = 6,
  empty = 'No records.',
}: {
  rows: any[]
  columns: DataCol[]
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  busy?: boolean
  searchable?: string[]
  searchPlaceholder?: string
  pageSize?: number
  empty?: string
}) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const anonymousIds = useRef(new WeakMap<object, string>())
  const nextAnonymousId = useRef(1)

  const visibleColumns = useMemo(() => columns.filter((column) => !isRatingColumn(column)), [columns])
  const filtered = useMemo(() => {
    if (!query.trim() || !searchable?.length) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) =>
      searchable.some((key) => String(row[key] ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query, searchable])

  const safePageSize = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(filtered.length / safePageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize)

  function rowId(row: any) {
    if (row?.id !== null && row?.id !== undefined) return `id:${row.id}`
    if (row && typeof row === 'object') {
      let id = anonymousIds.current.get(row)
      if (!id) {
        id = `row:${nextAnonymousId.current++}`
        anonymousIds.current.set(row, id)
      }
      return id
    }
    return `value:${String(row)}`
  }

  const pageIds = pageRows.map(rowId)
  const selectedCountOnPage = pageIds.filter((id) => selected.includes(id)).length
  const allSelected = pageRows.length > 0 && selectedCountOnPage === pageRows.length
  const someSelected = selectedCountOnPage > 0 && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelected((current) => current.filter((id) => !pageIds.includes(id)))
      return
    }
    setSelected((current) => Array.from(new Set([...current, ...pageIds])))
  }

  function toggleRow(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const hasActions = Boolean(onEdit || onDelete)
  const hasQuery = Boolean(query.trim())

  return (
    <Card className="min-w-0 gap-0 overflow-visible rounded-[14px] border-border bg-card pb-0 shadow-none" aria-busy={busy}>
      {searchable !== undefined && (
        <CardHeader className="gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder={searchPlaceholder}
              className="h-10 bg-background pl-9 pr-10"
              aria-label={searchPlaceholder === 'Search…' ? 'Search records' : searchPlaceholder}
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
                onClick={() => {
                  setQuery('')
                  setPage(1)
                }}
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span>{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</span>
            {selected.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{selected.length} selected</span>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              </>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="min-w-0 p-0">
        <Table className="min-w-[42rem]" aria-label="Admin records">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label={allSelected ? 'Clear selection on this page' : 'Select all rows on this page'}
                />
              </TableHead>
              {visibleColumns.map((column) => (
                <TableHead key={column.key} className={HEAD_CLASS} scope="col">
                  {column.label}
                </TableHead>
              ))}
              {hasActions && <TableHead className={`${HEAD_CLASS} text-right`} scope="col">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumns.length + (hasActions ? 2 : 1)}
                  className="px-6 py-12 text-center"
                >
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                    <p className="font-medium text-foreground">{hasQuery ? 'No matching records' : empty}</p>
                    <p className="text-sm text-muted-foreground">
                      {hasQuery ? `Nothing matches “${query.trim()}”. Try another search or clear the current one.` : 'Records will appear here when they are available.'}
                    </p>
                    {hasQuery && (
                      <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => { setQuery(''); setPage(1) }}>
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((row) => {
              const id = rowId(row)
              const rowName = String(row.name ?? row.title ?? row.label ?? `record ${id.replace(/^id:/, '')}`)
              return (
                <TableRow
                  key={id}
                  data-state={selected.includes(id) ? 'selected' : undefined}
                  className="hover:bg-muted/30"
                >
                  <TableCell className="px-4 py-3">
                    <Checkbox
                      checked={selected.includes(id)}
                      onCheckedChange={() => toggleRow(id)}
                      aria-label={`Select ${rowName}`}
                    />
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key} className="max-w-sm px-4 py-3 text-sm">
                      {renderDataCell(row, column)}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                      {onEdit && <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={() => onEdit(row)} aria-label={`Edit ${rowName}`}><Pencil size={14} aria-hidden="true" />Edit</button>}
                      {onDelete && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 px-3 text-xs"
                            disabled={busy}
                            aria-label={`Actions for ${rowName}`}
                          >
                            Actions
                            <ChevronDown data-icon="inline-end" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-w-[min(20rem,calc(100vw-1.5rem))]" aria-label={`Actions for ${rowName}`}>
                          <DropdownMenuGroup>
                            {onEdit && (
                              <DropdownMenuItem className="cursor-pointer whitespace-normal break-words py-2" onClick={() => onEdit(row)}>
                                Edit {rowName}
                              </DropdownMenuItem>
                            )}
                            {onDelete && (
                              <DropdownMenuItem
                                className="cursor-pointer py-2 text-destructive focus:text-destructive"
                                onClick={() => onDelete(row)}
                              >
                                Delete {rowName}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <Datatable1Pagination
          page={safePage}
          pageSize={safePageSize}
          total={filtered.length}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  )
}
