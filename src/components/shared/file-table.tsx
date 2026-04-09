"use client";

import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type Row,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import clsx from "clsx";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableSort {
  field: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  defaultColumnOrder: string[];
  isLoading: boolean;
  getRowId: (row: T) => string;
  // Sort
  sort: DataTableSort;
  onSort: (field: string) => void;
  // DnD context id
  dndId?: string;
  // Render slots
  renderRows: (rows: Row<T>[]) => ReactNode;
  renderLeadingRows?: (columnOrder: string[]) => ReactNode;
  renderEmptyState?: (colSpan: number) => ReactNode;
  renderSkeleton?: () => ReactNode;
  // Keyboard
  onKeyDown?: (e: React.KeyboardEvent) => void;
  ariaLabel?: string;
  tabIndex?: number;
}

export interface DataTableHandle {
  focus: () => void;
}

export interface TableSkeletonColumn {
  id: string;
  isFirst?: boolean;
}

// ---------------------------------------------------------------------------
// Header sub-components
// ---------------------------------------------------------------------------

function SortIcon({
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

function DraggableTableHeader({
  header,
  onSort,
  sort,
}: {
  header: Header<unknown, unknown>;
  onSort: (field: string) => void;
  sort: DataTableSort;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: header.column.id,
    });

  const colWidth = `var(--col-${header.column.id}-size)`;
  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative" as const,
    transform: CSS.Translate.toString(transform),
    transition,
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
            className={cn(
              "border-border absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize border-r",
              "hover:bg-primary/15 hover:border-primary/50",
              header.column.getIsResizing() && "bg-primary/25 border-primary h-9",
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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

const skeletonRowHeight = "h-9";
const skeletonRowCount = 30;

function TableSkeleton({ columns }: { columns?: TableSkeletonColumn[] }) {
  if (!columns || columns.length === 0) {
    return (
      <>
        {Array.from({ length: skeletonRowCount }).map((_, i) => (
          <TableRow key={i}>
            <TableCell className={`pl-6 text-left ${skeletonRowHeight}`}>
              <Skeleton className="h-4 w-full max-w-48" />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  }

  return (
    <>
      {Array.from({ length: skeletonRowCount }).map((_, i) => (
        <TableRow key={i}>
          {columns.map((col) => (
            <TableCell
              key={col.id}
              className={clsx(
                col.isFirst ? "pl-6" : "pl-2",
                "overflow-hidden",
                skeletonRowHeight,
              )}
              style={{
                width: `var(--col-${col.id}-size)`,
                minWidth: `var(--col-${col.id}-size)`,
                maxWidth: `var(--col-${col.id}-size)`,
              }}
            >
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

function DataTableInner<T>(
  {
    data,
    columns,
    defaultColumnOrder,
    isLoading,
    getRowId,
    sort,
    onSort,
    dndId = "data-table-dnd",
    renderRows,
    renderLeadingRows,
    renderEmptyState,
    renderSkeleton,
    onKeyDown,
    ariaLabel = "Data table",
    tabIndex,
  }: DataTableProps<T>,
  ref: React.Ref<DataTableHandle>,
) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);

  useImperativeHandle(ref, () => ({
    focus: () => tableContainerRef.current?.focus(),
  }));

  const table = useReactTable<T>({
    data,
    columns,
    state: {
      columnOrder,
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const columnSizingState = table.getState().columnSizing;
  const columnSizingInfoState = table.getState().columnSizingInfo;
  const columnSizeVars = useMemo(() => {
    const colSizes: Record<string, string> = {};
    for (const col of table.getAllFlatColumns()) {
      colSizes[`--col-${col.id}-size`] = `${col.getSize()}px`;
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is unstable from useReactTable
  }, [columns, columnSizingState, columnSizingInfoState]);

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const skeletonColumns = useMemo<TableSkeletonColumn[]>(() => {
    return columnOrder.map((id, index) => ({
      id,
      isFirst: index === 0,
    }));
  }, [columnOrder]);

  const wrappedKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyDown?.(e);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const direction = e.key;
        requestAnimationFrame(() => {
          const container = tableContainerRef.current;
          if (!container) return;
          const selected = container.querySelectorAll(
            'tr[aria-selected="true"]',
          );
          if (selected.length > 0) {
            const target =
              direction === "ArrowDown"
                ? selected[selected.length - 1]
                : selected[0];
            target.scrollIntoView({ block: "center" });
          } else {
            // Special row (leading/parent) — scroll to top of table body
            const firstRow = container.querySelector("tbody tr");
            firstRow?.scrollIntoView({ block: "center" });
          }
        });
      }
    },
    [onKeyDown],
  );

  return (
    <div
      ref={tableContainerRef}
      role="grid"
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      className="scrollbar-themed h-full min-h-0 overflow-auto rounded-md border outline-none"
      onKeyDown={wrappedKeyDown}
    >
      <DndContext
        id={dndId}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleColumnDragEnd}
        sensors={sensors}
      >
        <div className="relative min-w-max" style={columnSizeVars}>
          <Table disableScrollWrapper>
            <TableHeader className="border-border bg-background sticky top-0 z-20 border-b shadow-sm [&_tr]:bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-background">
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DraggableTableHeader
                        key={header.id}
                        header={header as Header<unknown, unknown>}
                        onSort={onSort}
                        sort={sort}
                      />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                renderSkeleton ? (
                  renderSkeleton()
                ) : (
                  <TableSkeleton columns={skeletonColumns} />
                )
              ) : (
                <>
                  {renderLeadingRows?.(columnOrder)}
                  {data.length === 0 && !isLoading ? (
                    renderEmptyState ? (
                      renderEmptyState(table.getAllLeafColumns().length)
                    ) : null
                  ) : (
                    renderRows(table.getRowModel().rows)
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </DndContext>
    </div>
  );
}

// Export with displayName for forwardRef generic pattern
export const DataTable = forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle> },
) => React.ReactElement;
