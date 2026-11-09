"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
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
import { applyColumnOrder, sameOrder } from "@/lib/table-layout";
import { useTableLayout } from "@/hooks/use-table-layout";
import { resizeColumns, type ColumnResizeStart } from "./column-resize";
import { followPointer } from "./pointer-drag";
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
  /** Overrides the default padding applied to the header cell (pl-6 for first, pl-2 for others). */
  headerClassName?: string;
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
  /** Where this table's column order and widths are remembered, e.g. "workspace". */
  layoutKey: string;
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
  widthSetting,
  isResizing,
  onResizeStart,
  onSort,
  sort,
}: {
  header: Header<FileTableFeatures, T>;
  /** The column's width in px (a prop, so the compiled header re-renders with it). */
  size: number | undefined;
  /**
   * The column's width setting, which the handle reports as its value. It
   * differs from `size` while a pointer drag sets rendered widths directly.
   */
  widthSetting: number | undefined;
  /** Whether this column is being resized (a prop, for the same reason). */
  isResizing: boolean;
  /** Starts a pointer resize of this column from the handle's pointerdown. */
  onResizeStart: (
    columnId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => void;
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

  const meta = header.column.columnDef.meta;
  const style = {
    "--col-size": columnSizeValue(size),
    // Undefined (no drag offset) drops the property, so transform is none.
    "--drag-transform": CSS.Translate.toString(transform),
    // dnd-kit's own shorthand ("transform 200ms ease"); no utility sets it.
    transition,
  } as CSSProperties;

  const isFirst = header.index === 0;
  const className = clsx(
    // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
    meta?.headerClassName ?? (isFirst ? "pl-6" : "pl-2"),
    // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
    meta?.className ?? "",
    // Last, so these win over the meta classes (as the inline style they
    // replace did).
    "relative w-(--col-size) max-w-(--col-size) min-w-(--col-size) transform-(--drag-transform) whitespace-nowrap",
    // No z-index at rest: a positioned cell with one is a stacking context,
    // and the next cell's opaque background would then paint over the half
    // of this cell's resize handle that straddles the shared edge. A dragged
    // header rises above every handle.
    isDragging && "z-20 opacity-80",
  );
  const isLast = header.index === (header.headerGroup?.headers.length ?? 0) - 1;

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
      data-column-id={header.column.id}
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
      </div>
      {header.column.getCanResize() && (
        // A child of the cell, not of its content box, so it spans the full
        // header height and sits on the cell's edge. The hit area straddles
        // the edge (the last column's stays inside, so the table does not
        // overflow its scroll box); the line inside it is the divider, `info`
        // while active because the dark themes keep a dark primary.
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
          aria-valuemin={minSize}
          aria-valuemax={maxSize}
          aria-valuenow={widthSetting}
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
          onPointerDown={(event) => {
            onResizeStart(header.column.id, event);
          }}
          onDoubleClick={() => {
            header.column.resetSize();
          }}
          className={cn(
            "group/resize absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none select-none focus-visible:outline-2 focus-visible:outline-primary",
            !isLast && "translate-x-1/2",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-2 transition-colors",
              isLast ? "right-0" : "left-1/2 -translate-x-1/2",
              isResizing
                ? "w-0.5 bg-info"
                : "w-px bg-border group-hover/resize:w-0.5 group-hover/resize:bg-info/50 group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-info",
            )}
          />
        </div>
      )}
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
    layoutKey,
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
  const [tableLayout, updateTableLayout] = useTableLayout(layoutKey);
  // Explicit memo: the compiler leaves this unmemoized, and a new array re-renders every row.
  // Keyed on serialized ids: any layout save (widths, visibility) re-parses storage
  // and yields a new `order` array, and the JSON key keeps columnOrder's identity
  // across those saves. The default-order key is defensive (current callers pass
  // module constants).
  const defaultOrderKey = JSON.stringify(defaultColumnOrder);
  const savedOrderKey = tableLayout.order
    ? JSON.stringify(tableLayout.order)
    : null;
  const columnOrder = useMemo(
    () =>
      applyColumnOrder(
        JSON.parse(defaultOrderKey) as string[],
        savedOrderKey === null
          ? undefined
          : (JSON.parse(savedOrderKey) as string[]),
      ),
    [defaultOrderKey, savedOrderKey],
  );
  const setColumnOrder = (next: string[]) => {
    updateTableLayout({
      order: sameOrder(next, defaultColumnOrder) ? undefined : next,
    });
  };
  // Live widths during a drag stay in component state (no storage write per
  // pointer move); finished resizes are committed by the effect below, which
  // then empties this so the saved widths (and any later change to them, such
  // as another tab's) are what the table shows.
  const [liveColumnSizing, setLiveColumnSizing] = useState<
    Record<string, number>
  >({});
  const columnSizing = { ...tableLayout.widths, ...liveColumnSizing };
  // Which columns the user resized (or reset with a double-click on the handle,
  // which deletes the size) since the layout was last saved. Only ids are kept:
  // Pointer drags bypass the TanStack sizing state, which only receives
  // keyboard steps and double-click resets; getSize() clamps those to
  // minSize/maxSize.
  // The pointer drag in progress: its column, and (once the pointer moves) the
  // rendered width and width setting of every rendered column (CSS-hidden
  // columns are left out).
  const [pointerResize, setPointerResize] = useState<{
    columnId: string;
    widths?: Record<string, number>;
    settings?: Record<string, number>;
  } | null>(null);
  const pendingWidthCommitRef = useRef({
    resized: new Set<string>(),
    reset: new Set<string>(),
  });

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
      columnSizing,
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    onColumnSizingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnSizing) : updater;
      const pending = pendingWidthCommitRef.current;
      for (const [columnId, width] of Object.entries(next)) {
        if (columnSizing[columnId] !== width) {
          pending.resized.add(columnId);
          pending.reset.delete(columnId);
        }
      }
      for (const columnId of Object.keys(columnSizing)) {
        if (!Object.hasOwn(next, columnId)) {
          pending.reset.add(columnId);
          pending.resized.delete(columnId);
        }
      }
      setLiveColumnSizing(next);
    },
    getRowId,
    enableColumnResizing: true,
  });

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  // Save keyboard resizes and double-click resets as soon as they happen (a
  // pointer drag saves itself on release, in startPointerResize). The width
  // saved is what the column renders at, so it stays inside the saved-layout
  // schema.
  useEffect(() => {
    const { resized, reset } = pendingWidthCommitRef.current;
    if (resized.size === 0 && reset.size === 0) return;
    // Copied before the sets are cleared, so the updater below reads them.
    const resizedIds = [...resized];
    const resetIds = [...reset];
    resized.clear();
    reset.clear();
    // Merged into the widths stored now, so another tab's save survives.
    updateTableLayout((current) => {
      const widths: Record<string, number> = { ...current.widths };
      for (const columnId of resizedIds) {
        const column = table.getColumn(columnId);
        if (column) widths[columnId] = Math.round(column.getSize());
      }
      for (const columnId of resetIds) Reflect.deleteProperty(widths, columnId);
      return { widths: Object.keys(widths).length > 0 ? widths : undefined };
    });
    // The write above is read back on the same re-render (a write storage
    // refuses is kept in memory), so the widths on screen do not change.
    setLiveColumnSizing({});
    // liveColumnSizing is not read here, but every resize and reset replaces
    // it, so it is what re-runs this.
  }, [
    liveColumnSizing,
    tableLayout.widths,
    table,
    updateTableLayout,
  ]);

  // Computed after the hooks above: the React Compiler does not cache a value
  // whose computation spans a hook call. Cached, it changes when `table` does.
  const columnSizes: FileTableColumnSizes = Object.fromEntries(
    table.getAllFlatColumns().map((col) => [col.id, col.getSize()]),
  );

  // A pointer drag sets every rendered column's width directly, so the dragged
  // edge follows the pointer (see column-resize.ts). Its settings are saved
  // once, on release. Only columns the browser lays out take part:
  // `hidden md:table-cell` and its kin hide Owner, Created and Type on narrow
  // screens, and those keep their saved widths.
  const startPointerResize = (
    columnId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const container = tableContainerRef.current;
    const rendered = new Set(
      [...(container?.querySelectorAll<HTMLElement>("th[data-column-id]") ?? [])]
        .filter((cell) => getComputedStyle(cell).display !== "none")
        .map((cell) => cell.dataset.columnId),
    );
    const leafColumns = table
      .getVisibleLeafColumns()
      .filter((column) => rendered.has(column.id));
    const index = leafColumns.findIndex((column) => column.id === columnId);
    if (index === -1) return;
    const start: ColumnResizeStart = {
      columnIds: leafColumns.map((column) => column.id),
      sizes: leafColumns.map((column) => column.getSize()),
      minSizes: leafColumns.map((column) => column.columnDef.minSize ?? 40),
      maxSizes: leafColumns.map((column) => column.columnDef.maxSize ?? 1000),
      index,
      containerWidth: container?.clientWidth ?? 0,
    };
    const startX = event.clientX;
    let settings: Record<string, number> = {};
    const started = followPointer(event, {
      onMove: (clientX) => {
        const next = resizeColumns(start, clientX - startX);
        settings = next.settings;
        setPointerResize({
          columnId,
          widths: Object.fromEntries(
            start.columnIds.map((id, i) => [id, next.widths[i]]),
          ),
          settings: Object.fromEntries(
            start.columnIds.map((id, i) => [id, settings[id] ?? start.sizes[i]]),
          ),
        });
      },
      onEnd: (released) => {
        if (released && Object.keys(settings).length > 0) {
          const committed = settings;
          // Merged into the widths stored now, not at the press: another tab
          // may have saved since. Read back on the same re-render, so nothing
          // moves on release.
          updateTableLayout((current) => ({
            widths: { ...current.widths, ...committed },
          }));
        }
        setPointerResize(null);
      },
    });
    if (started) setPointerResize({ columnId });
  };

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
      className={cn(
        "scrollbar-themed h-full min-h-0 overflow-auto rounded-md border outline-none",
        // A drag outruns its handle whenever the column stops at its minimum
        // or maximum width; keep the resize cursor (not a header's grab or a
        // row's pointer) and text selection off until it is released.
        pointerResize && "cursor-col-resize select-none **:cursor-col-resize",
      )}
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
                        size={
                          pointerResize?.widths?.[header.column.id] ??
                          columnSizes[header.column.id]
                        }
                        widthSetting={
                          pointerResize?.settings?.[header.column.id] ??
                          columnSizes[header.column.id]
                        }
                        isResizing={
                          pointerResize?.columnId === header.column.id
                        }
                        onResizeStart={startPointerResize}
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
