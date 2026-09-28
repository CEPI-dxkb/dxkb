"use client";

import React, {
  createContext,
  useContext,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  FlexRender,
  metaHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
  type Header,
  type Row,
  type RowData,
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
import { clsx } from "cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableSort {
  field: string;
  direction: "asc" | "desc";
}

export interface FileTableColumnMeta {
  className?: string;
  sortField?: string;
}

const fileTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  columnMeta: metaHelper<FileTableColumnMeta>(),
});

export type FileTableFeatures = typeof fileTableFeatures;

export interface DataTableProps<T extends RowData> {
  data: T[];
  columns: ColumnDef<FileTableFeatures, T>[];
  defaultColumnOrder: string[];
  isLoading: boolean;
  getRowId: (row: T) => string;
  // Sort
  sort: DataTableSort;
  onSort: (field: string) => void;
  // DnD context id
  dndId?: string;
  children: ReactNode;
  skeleton?: ReactNode;
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

/** Each column's width in px, keyed by column id. */
type FileTableColumnSizes = Record<string, number>;

/**
 * Body rows carry no widths. The table uses fixed layout, which takes every
 * column's width from the first row (the header), so a resize re-renders only
 * the header cells.
 */
interface DataTableBodyContextValue<T extends RowData> {
  rows: Row<FileTableFeatures, T>[];
  columnOrder: string[];
  colSpan: number;
}

const DataTableBodyContext =
  createContext<DataTableBodyContextValue<Record<string, unknown>> | null>(null);

/**
 * The `--col-size` value for a header cell of the given column width (px),
 * which its `w-(--col-size)` classes read. An unknown column (no size) leaves
 * it unset, so the width stays auto.
 */
function columnSizeValue(size: number | undefined) {
  return size === undefined ? undefined : `${String(size)}px`;
}

/**
 * A row's visible cells in `columnOrder` (from `useDataTableBody()`). Use this
 * rather than `row.getVisibleCells()` alone: the React Compiler caches a row's
 * cells on the `row` object, which a column reorder does not replace, so the
 * order has to be an input for the row to re-render with it.
 */
export function orderedCells<T extends RowData>(
  row: Row<FileTableFeatures, T>,
  columnOrder: string[],
) {
  const cells = new Map(
    row.getVisibleCells().map((cell) => [cell.column.id, cell]),
  );
  return columnOrder.flatMap((id) => cells.get(id) ?? []);
}

export function useDataTableBody<T extends RowData>() {
  const context = useContext(DataTableBodyContext);
  if (!context) {
    throw new Error("useDataTableBody must be used within DataTable");
  }
  return context as DataTableBodyContextValue<T>;
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
      <ArrowUpDown className="ml-1 inline-block size-3 align-middle text-muted-foreground/50" />
    );
  }
  return currentSort.direction === "asc" ? (
    <ArrowUp className="ml-1 inline-block size-3 align-middle" />
  ) : (
    <ArrowDown className="ml-1 inline-block size-3 align-middle" />
  );
}

function DraggableTableHeader<T extends RowData>({
  header,
  size,
  isResizing,
  onSort,
  sort,
}: {
  header: Header<FileTableFeatures, T>;
  /** The column's width in px (a prop, so the compiled header re-renders with it). */
  size: number | undefined;
  /** Whether this column is being resized (a prop, for the same reason). */
  isResizing: boolean;
  onSort: (field: string) => void;
  sort: DataTableSort;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: header.column.id,
  });

  const style = {
    "--col-size": columnSizeValue(size),
    // Undefined (no drag offset) drops the property, so transform is none.
    "--drag-transform": CSS.Translate.toString(transform),
    // dnd-kit's own shorthand ("transform 200ms ease"); no utility sets it.
    transition,
  } as CSSProperties;

  const meta = header.column.columnDef.meta;
  const isFirst = header.index === 0;
  const className = clsx(
    isFirst ? "pl-6" : "pl-2",
    // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
    meta?.className ?? "",
    // Last, so these win over the meta classes (as the inline style they
    // replace did).
    "relative w-(--col-size) max-w-(--col-size) min-w-(--col-size) transform-(--drag-transform) whitespace-nowrap",
    isDragging ? "z-1 opacity-80" : "z-0",
  );

  const sortField = meta?.sortField;
  const label = header.column.columnDef.header as string;
  const minSize = header.column.columnDef.minSize ?? 40;
  const maxSize = header.column.columnDef.maxSize ?? 1000;
  const resizeWithKeyboard = (delta: number) => {
    const size = Math.min(
      maxSize,
      Math.max(minSize, header.column.getSize() + delta),
    );
    header.getContext().table.setColumnSizing((current) => ({
      ...current,
      [header.column.id]: size,
    }));
  };

  return (
    <TableHead
      ref={setNodeRef}
      colSpan={header.colSpan}
      variant="surface"
      className={className}
      style={style}
    >
      <div className="relative flex w-full items-center gap-1 py-0">
        <div
          className="inline-flex cursor-grab touch-none select-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <FlexRender header={header} />
        </div>
        {sortField && (
          <button
            type="button"
            onClick={() => {
              onSort(sortField);
            }}
            className="cursor-pointer rounded p-0.5 select-none hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Sort by ${label}`}
          >
            <SortIcon field={sortField} currentSort={sort} />
          </button>
        )}
        {header.column.getCanResize() && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${label} column`}
            aria-valuemin={minSize}
            aria-valuemax={maxSize}
            aria-valuenow={size}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                resizeWithKeyboard(-10);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                resizeWithKeyboard(10);
              }
            }}
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            onDoubleClick={() => {
              header.column.resetSize();
            }}
            className={cn(
              "absolute top-0 right-0 z-10 h-full w-2 translate-x-1/2 cursor-col-resize border-r border-border focus-visible:outline-2 focus-visible:outline-primary",
              "hover:border-primary/50 hover:bg-primary/15",
              isResizing && "h-9 border-primary bg-primary/25",
            )}
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

function DataTableInner<T extends RowData>(
  {
    data,
    columns,
    defaultColumnOrder,
    isLoading,
    getRowId,
    sort,
    onSort,
    dndId = "data-table-dnd",
    children,
    skeleton,
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

  const table = useTable({
    features: fileTableFeatures,
    data,
    columns,
    defaultColumn: {
      minSize: 40,
      maxSize: 1000,
    },
    state: {
      columnOrder,
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    getRowId,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  // Computed after the hooks above: the React Compiler does not cache a value
  // whose computation spans a hook call. Cached, it changes when `table` does.
  const columnSizes: FileTableColumnSizes = Object.fromEntries(
    table.getAllFlatColumns().map((col) => [col.id, col.getSize()]),
  );

  // Separate values, so the body context below is cached on them and keeps
  // its identity through a resize (`table` changes on every state update, but
  // the row model does not).
  const rows = table.getRowModel().rows;
  const colSpan = table.getAllLeafColumns().length;

  const skeletonColumns: TableSkeletonColumn[] = columnOrder.map(
    (id, index) => ({
      id,
      isFirst: index === 0,
    }),
  );

  const wrappedKeyDown = (e: React.KeyboardEvent) => {
    onKeyDown?.(e);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const direction = e.key;
      requestAnimationFrame(() => {
        const container = tableContainerRef.current;
        if (!container) return;
        const selected = container.querySelectorAll('tr[aria-selected="true"]');
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
  };

  return (
    <div
      ref={tableContainerRef}
      role="region"
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
        {/* No min-w-max here: Chrome gives a fixed-layout table with a
            percentage width a near-infinite max-content width. A fixed table
            is still as wide as its columns, so a wide table overflows this
            box and the region scrolls. */}
        <div className="relative">
          {/* Fixed layout: the header row sets the column widths. */}
          <Table disableScrollWrapper className="table-fixed">
            <TableHeader variant="sticky-surface" className="sticky top-0 z-20">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DraggableTableHeader
                        key={header.id}
                        header={header}
                        size={columnSizes[header.column.id]}
                        isResizing={header.column.getIsResizing()}
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
                (skeleton ?? <TableSkeleton columns={skeletonColumns} />)
              ) : (
                <DataTableBodyContext.Provider
                  value={
                    {
                      rows,
                      columnOrder,
                      colSpan,
                    } as unknown as DataTableBodyContextValue<
                      Record<string, unknown>
                    >
                  }
                >
                  {children}
                </DataTableBodyContext.Provider>
              )}
            </TableBody>
          </Table>
        </div>
      </DndContext>
    </div>
  );
}

// Export with displayName for forwardRef generic pattern
export const DataTable = forwardRef(DataTableInner) as <T extends RowData>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle> },
) => React.ReactElement;
