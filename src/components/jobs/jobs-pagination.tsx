"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobsPaginationProps {
  offset: number;
  limit: number;
  totalOnPage: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function JobsPagination({
  offset,
  limit,
  totalOnPage,
  onPrevious,
  onNext,
}: JobsPaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const hasPrevious = offset > 0;
  const hasNext = totalOnPage === limit;

  return (
    <div className="flex items-center justify-between px-2 py-2">
      <span className="text-muted-foreground text-xs">
        Page {page}
        {" \u00B7 "}
        Showing {offset + 1}{"\u2013"}{offset + totalOnPage} jobs
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
