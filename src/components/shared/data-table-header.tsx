"use client";

import type { CSSProperties } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { Header } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataTableSort } from "./data-table";

export function SortIcon({
  field,
  currentSort,
}: {
  field: string;
  currentSort: DataTableSort;
}) {
  if (currentSort.field !== field) {
    return (
      <ArrowUpDown className="text-muted-foreground/50 ml-1 inline-block h-3 w-3 align-middle" />
    );
  }
  return currentSort.direction === "asc" ? (
    <ArrowUp className="ml-1 inline-block h-3 w-3 align-middle" />
  ) : (
    <ArrowDown className="ml-1 inline-block h-3 w-3 align-middle" />
  );
}

export function DraggableTableHeader({
  header,
  onSort,
  sort,
}: {
  header: Header<unknown, unknown>;
  onSort: (field: string) => void;
  sort: DataTableSort;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    });

  const colWidth = `var(--col-${header.column.id}-size)`;
  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative" as const,
    transform: CSS.Translate.toString(transform),
    transition: "transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: colWidth,
    minWidth: colWidth,
    maxWidth: colWidth,
    zIndex: isDragging ? 1 : 0,
  };

  const meta = header.column.columnDef.meta as
    | { className?: string; sortField?: string }
    | undefined;
  const isFirst = header.index === 0;
  const className = clsx(
    isFirst ? "pl-6" : "pl-2",
    "relative bg-background",
    meta?.className ?? "",
  );

  const sortField = meta?.sortField;
  const label = header.column.columnDef.header as string;

  return (
    <TableHead
      ref={setNodeRef}
      colSpan={header.colSpan}
      className={className}
      style={style}
    >
      <div className="relative flex w-full items-center gap-1 py-0">
        <div
          className="inline-flex cursor-grab touch-none select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          {label}
        </div>
        {sortField && (
          <button
            type="button"
            onClick={() => onSort(sortField)}
            className="hover:bg-primary/10 focus-visible:ring-primary cursor-pointer rounded p-0.5 select-none focus:outline-none focus-visible:ring-2"
            aria-label={`Sort by ${label}`}
          >
            <SortIcon field={sortField} currentSort={sort} />
          </button>
        )}
        {header.column.getCanResize() && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            onDoubleClick={() => header.column.resetSize()}
            className={clsx(
              "border-border absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize border-r",
              "hover:bg-primary/15 hover:border-primary/50",
              header.column.getIsResizing() && "bg-primary/25 border-primary",
            )}
            style={{
              transform: "translateX(50%)",
            }}
          />
        )}
      </div>
    </TableHead>
  );
}

const skeletonRowHeight = "h-9";

export function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="pl-6">
          <TableCell className={`pl-6 text-left ${skeletonRowHeight}`}>
            <div className="flex h-5 items-center gap-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-40 shrink-0" />
            </div>
          </TableCell>
          <TableCell
            className={`text-muted-foreground pl-6 text-left ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-14" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground hidden pl-6 text-left md:table-cell ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground pl-6 text-left ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground hidden pl-6 text-left sm:table-cell ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell
            className={`text-muted-foreground hidden pl-6 text-left lg:table-cell ${skeletonRowHeight}`}
          >
            <Skeleton className="h-4 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
