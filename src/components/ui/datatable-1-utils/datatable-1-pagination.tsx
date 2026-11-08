"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Datatable1PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Datatable1Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: Datatable1PaginationProps) {
  const safePageSize = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const from = total === 0 ? 0 : (safePage - 1) * safePageSize + 1
  const to = Math.min(safePage * safePageSize, total)
  const pages: number[] = []
  const start = Math.max(1, Math.min(safePage - 2, pageCount - 4))
  for (let p = start; p <= Math.min(pageCount, start + 4); p++) pages.push(p)

  return (
    <nav className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3" aria-label="Table pagination">
      <p className="text-xs text-muted-foreground sm:text-sm" aria-live="polite">
        Showing <span className="font-medium text-foreground">{from}</span> to{" "}
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> entries
      </p>
      <div className="flex max-w-full flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        {pages.map((p) => (
          <Button
            type="button"
            key={p}
            variant={p === safePage ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-9 w-9 p-0", p === safePage && "border-ring/50 font-semibold")}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === safePage ? "page" : undefined}
          >
            {p}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
