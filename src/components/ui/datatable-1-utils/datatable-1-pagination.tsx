"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Datatable1PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Datatable1Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: Datatable1PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  for (let p = start; p <= Math.min(pageCount, start + 4); p++) pages.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span> to{" "}
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> entries
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            variant={p === page ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-8 w-8 p-0", p === page && "font-semibold")}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
