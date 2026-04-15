"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageSizeOptions } from "@/lib/jobs/constants";

const pageSizeItems = pageSizeOptions.map((size) => ({
  value: String(size),
  label: String(size),
}));

interface JobsPaginationProps {
  offset: number;
  limit: number;
  totalOnPage: number;
  totalTasks: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 4) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 3) {
    pages.push("ellipsis");
  }

  pages.push(total);

  return pages;
}

export function JobsPagination({
  offset,
  limit,
  totalOnPage,
  totalTasks,
  onPrevious,
  onNext,
  onPageSizeChange,
  onPageChange,
}: JobsPaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalTasks / limit));
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < totalTasks;
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-between px-2 py-2">
      <span className="text-muted-foreground text-xs">
        {totalTasks === 0
          ? "No jobs found"
          : <>Showing {offset + 1}{"\u2013"}{offset + totalOnPage} of {totalTasks} jobs</>}
      </span>
      <div className="flex items-center gap-1">
        <Select
          items={pageSizeItems}
          value={String(limit)}
          onValueChange={(value) =>
            value != null && onPageSizeChange(Number(value))
          }
        >
          <SelectTrigger className="mr-1 h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-0!">
            <SelectGroup>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-9 w-9 rounded-lg p-0"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="text-muted-foreground flex h-9 w-9 items-center justify-center text-sm"
            >
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              className="h-9 w-9 rounded-lg p-0 text-sm"
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          className="h-9 w-9 rounded-lg p-0"
          onClick={onNext}
          disabled={!hasNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
