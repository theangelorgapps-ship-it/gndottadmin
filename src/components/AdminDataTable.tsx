"use client"

import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
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
import { img } from './Poster'

export type DataCol = {
  key: string
  label: string
  kind?: 'text' | 'title' | 'img' | 'pill' | 'money' | 'date' | 'stars' | 'access'
}

const HEAD_CLASS = 'p-4 font-medium text-sm text-muted-foreground uppercase tracking-wider'

export function renderDataCell(r: any, c: DataCol) {
  const v = r[c.key]
  switch (c.kind) {
    case 'img':
      return (
        <div className="flex items-center gap-3">
          <img src={img(v)} alt="" className="w-[46px] h-[60px] object-cover rounded-md" />
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">
              {r[c.key.replace('file_url', 'name').replace('poster_url', 'name')] ?? r.name ?? ''}
            </div>
            {r.release_date ? (
              <div className="text-xs text-muted-foreground">{String(r.release_date).slice(0, 10)}</div>
            ) : null}
          </div>
        </div>
      )
    case 'title':
      return <span className="font-medium text-foreground">{v ?? '—'}</span>
    case 'pill':
      return <span className={`pill ${v == 1 ? 'on' : 'off'}`}>{v == 1 ? 'Active' : 'Off'}</span>
    case 'access':
      return <span className={`pill ${v === 'free' ? 'info' : 'on'}`}>{v === 'free' ? 'Free' : 'Paid'}</span>
    case 'money':
      return <>${Number(v ?? 0).toFixed(2)}</>
    case 'date':
      return <>{v ? String(v).slice(0, 10) : '—'}</>
    case 'stars':
      return <>{'★'.repeat(Math.round(Number(v) || 0))}{'☆'.repeat(5 - Math.round(Number(v) || 0))}</>
    default:
      return <span className="text-muted-foreground">{v ?? '—'}</span>
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

  const filtered = useMemo(() => {
    if (!query.trim() || !searchable?.length) return rows
    const q = query.toLowerCase()
    return rows.filter((r) =>
      searchable.some((k) => String(r[k] ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query, searchable])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const rowId = (r: any, i: number) => String(r.id ?? i)
  const allSelected = pageRows.length > 0 && pageRows.every((r, i) => selected.includes(rowId(r, i)))
  const toggleAll = () =>
    setSelected(allSelected ? [] : pageRows.map((r, i) => rowId(r, i)))
  const toggleRow = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const hasActions = Boolean(onEdit || onDelete)

  return (
    <Card className="pb-0 gap-0 border-border">
      {searchable && (
        <CardHeader className="border-b border-border gap-0">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder={searchPlaceholder}
              className="pl-9 bg-background"
              aria-label="Search"
            />
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="p-4 w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all rows"
                />
              </TableHead>
              {columns.map((c) => (
                <TableHead key={c.key} className={HEAD_CLASS}>
                  {c.label}
                </TableHead>
              ))}
              {hasActions && <TableHead className={HEAD_CLASS}>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (hasActions ? 2 : 1)}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r, i) => {
              const id = rowId(r, i)
              return (
                <TableRow
                  key={id}
                  data-state={selected.includes(id) ? 'selected' : undefined}
                  className="hover:bg-muted/30"
                >
                  <TableCell className="p-4">
                    <Checkbox
                      checked={selected.includes(id)}
                      onCheckedChange={() => toggleRow(id)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="p-4 text-sm">
                      {renderDataCell(r, c)}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs cursor-pointer"
                            disabled={busy}
                          >
                            Actions
                            <ChevronDown data-icon="inline-end" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            {onEdit && (
                              <DropdownMenuItem className="cursor-pointer py-2" onClick={() => onEdit(r)}>
                                Edit
                              </DropdownMenuItem>
                            )}
                            {onDelete && (
                              <DropdownMenuItem
                                className="text-destructive cursor-pointer py-2"
                                onClick={() => onDelete(r)}
                              >
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <Datatable1Pagination
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  )
}
