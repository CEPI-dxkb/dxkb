import { Button } from "@/components/ui/button";
import type { DataTableInstance } from "./data-table";

function getPageRange(
  pageIndex: number,
  pageSize: number,
  totalItems: number,
  dataLength: number,
  isLoading: boolean,
) {
  if (totalItems === 0) return { start: 0, end: 0 };
  const start = pageIndex * pageSize + 1;
  if (isLoading) {
    return { start, end: Math.min(start + pageSize - 1, totalItems) };
  }
  return {
    start,
    end: dataLength > 0 ? Math.min(start + dataLength - 1, totalItems) : 0,
  };
}

function getVisiblePages(currentPage: number, pageCount: number) {
  const pages: number[] = [];
  if (pageCount > 0) pages.push(0);
  for (let page = currentPage - 2; page <= currentPage + 2; page++) {
    if (page > 0 && page < pageCount - 1) pages.push(page);
  }
  if (pageCount > 1) pages.push(pageCount - 1);
  return [...new Set(pages)].sort((a, b) => a - b);
}

interface DataTableFooterProps {
  table: DataTableInstance;
  resource: string;
  totalItems: number;
  dataLength: number;
  isLoading: boolean;
  isAllPagesSelected: boolean;
  totalSelectedCount?: number;
}

export function DataTableFooter({
  table,
  resource,
  totalItems,
  dataLength,
  isLoading,
  isAllPagesSelected,
  totalSelectedCount,
}: DataTableFooterProps) {
  // Extracted out of useDataTableContent ("use no memo"): the compiler would
  // otherwise key this on `table` identity alone, which is only unstable by
  // accident (see the useTable call in data-table.tsx).
  "use no memo";

  const { pageIndex, pageSize } = table.state.pagination;
  const { start, end } = getPageRange(
    pageIndex,
    pageSize,
    totalItems,
    dataLength,
    isLoading,
  );
  const selectedCount = isAllPagesSelected
    ? totalItems
    : (totalSelectedCount ?? Object.keys(table.state.rowSelection).length);
  const uniquePages = getVisiblePages(pageIndex, table.getPageCount());
  // Loading with nothing counted yet is a first read, not an empty result, so
  // "Showing 0-0 of 0 results" is withheld.
  const isCounting = isLoading && totalItems === 0;

  return (
    <div className="z-10 w-full border-t border-border bg-muted py-1 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-y-1 px-2">
        <div className="shrink-0 text-xs">
          <div className="flex flex-col">
            <span>
              {isCounting
                ? "Loading results…"
                : `Showing ${String(start)}-${String(end)} of ${String(totalItems)} results`}
            </span>
            {selectedCount > 0 && (
              <span className="font-semibold text-info">
                {isAllPagesSelected
                  ? `All ${String(totalItems)} results selected`
                  : `${String(selectedCount)} selected`}
              </span>
            )}
          </div>
        </div>
        <nav
          className="flex flex-wrap items-center gap-x-1"
          aria-label={`${resource} results pagination`}
        >
          <Button
            onClick={() => {
              table.previousPage();
            }}
            disabled={!table.getCanPreviousPage()}
            aria-label="Prev page"
            variant="pager-step"
            size="pager"
          >
            {"Prev"}
          </Button>
          {uniquePages.map((page, index) => {
            const previous = index > 0 ? uniquePages[index - 1] : undefined;
            return (
              <span key={page} className="flex items-center gap-x-1">
                {previous !== undefined && page - previous > 1 && (
                  <span className="text-muted-foreground">...</span>
                )}
                <Button
                  onClick={() => {
                    table.setPageIndex(page);
                  }}
                  variant="pager"
                  size="pager"
                  aria-current={pageIndex === page ? "page" : undefined}
                >
                  {page + 1}
                </Button>
              </span>
            );
          })}
          <Button
            onClick={() => {
              table.nextPage();
            }}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
            variant="pager-step"
            size="pager"
          >
            {"Next"}
          </Button>
        </nav>
      </div>
    </div>
  );
}
