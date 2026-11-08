"use client";

import { useState } from "react";
import { ListFilter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Datatable1Toolbar({
  placeholder = "Search…",
  onSearch,
}: {
  placeholder?: string;
  onSearch?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch?.(e.target.value);
          }}
          placeholder={placeholder}
          className="pl-9 bg-background"
          aria-label="Search"
        />
      </div>
      <Button variant="outline" size="sm" className="h-9 gap-2">
        <ListFilter className="size-4" />
        Filter
      </Button>
    </div>
  );
}
