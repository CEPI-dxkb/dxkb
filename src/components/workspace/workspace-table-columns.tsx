"use client";

import { useMemo, useCallback } from "react";
import type { CSSProperties } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  type ColumnDef,
  type Header,
} from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import {
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceItemIcon } from "./workspace-item-icon";
import type {
  WorkspaceBrowserItem,
  SortField,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";
import { formatFileSize, formatDate } from "@/lib/services/workspace/helpers";
import { isFolderType } from "@/lib/services/workspace/utils";

export function formatOwner(ownerId: string): string {
  if (!ownerId) return "";
  return ownerId.replace(/@bvbrc$/, "");
}

export function formatMemberCount(count: number): string {
  if (count <= 0) return "\u2014";
  if (count === 1) return "Only me";
  return `${count} members`;
}

export function SortIcon({
  field,
  currentSort,
}: {
  field: SortField;
  currentSort: WorkspaceBrowserSort;
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

/** Row height matching real data: TableCell p-2 (8px top/bottom) + 20px content = 36px (h-9). */
const skeletonRowHeight = "h-9";

/** Skeleton rows matching real table column order (Name, Size, Owner, Members, Created, Type). */
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

export function DraggableTableHeader({
  header,
  onSort,
  sort,
}: {
  header: Header<WorkspaceBrowserItem, unknown>;
  onSort: (field: SortField) => void;
  sort: WorkspaceBrowserSort;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative" as const,
    transform: CSS.Translate.toString(transform),
    transition: "width 0.2s ease-in-out, transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  const meta = header.column.columnDef.meta as
    | { className?: string; sortField?: SortField }
    | undefined;
  const isFirst = header.column.id === "name";
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
      style={{
        ...style,
        minWidth: style.width,
        maxWidth: style.width,
      }}
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

export function useWorkspaceColumns(
  sort: WorkspaceBrowserSort,
  onSortChange: (sort: WorkspaceBrowserSort) => void,
  memberCountByPath: Record<string, number> | undefined,
) {
  const handleSort = useCallback(
    (field: SortField) => {
      if (sort.field === field) {
        onSortChange({
          field,
          direction: sort.direction === "asc" ? "desc" : "asc",
        });
      } else {
        onSortChange({ field, direction: "asc" });
      }
    },
    [sort.field, sort.direction, onSortChange],
  );

  const columns = useMemo<ColumnDef<WorkspaceBrowserItem>[]>(() => {
    return [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const item = row.original;
          const isNavigable = isFolderType(item.type);
          return (
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <WorkspaceItemIcon type={item.type} className="shrink-0" />
              <span
                className={`truncate ${isNavigable ? "font-medium hover:underline" : ""}`}
                title={item.name}
              >
                {item.name}
              </span>
            </div>
          );
        },
        meta: { className: "", sortField: "name" as SortField },
        size: 220,
        enableResizing: true,
      },
      {
        id: "size",
        accessorKey: "size",
        header: "Size",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatFileSize(Number(getValue()) || 0)}
          </span>
        ),
        meta: { className: "", sortField: "size" as SortField },
        size: 50,
        enableResizing: true,
      },
      {
        id: "owner_id",
        accessorKey: "owner_id",
        header: "Owner",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatOwner(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: "hidden md:table-cell", sortField: "owner_id" as SortField },
        size: 70,
        enableResizing: true,
      },
      {
        id: "creation_time",
        accessorKey: "creation_time",
        header: "Created",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatDate(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: "hidden sm:table-cell", sortField: "creation_time" as SortField },
        size: 80,
        enableResizing: true,
      },
      {
        id: "members",
        header: "Members",
        cell: ({ row }) => {
          const count = memberCountByPath?.[row.original.path];
          return (
            <span className="text-muted-foreground block truncate">
              {count != null ? formatMemberCount(count) : "\u2014"}
            </span>
          );
        },
        meta: { className: "" },
        size: 55,
        enableResizing: true,
      },
      {
        id: "type",
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {String(getValue() ?? "")}
          </span>
        ),
        meta: { className: "hidden lg:table-cell", sortField: "type" as SortField },
        size: 60,
        enableResizing: true,
      },
    ];
  }, [memberCountByPath]);

  return { columns, handleSort };
}
