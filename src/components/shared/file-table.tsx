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

export interface DataTableSort {
  field: string;
  direction: "asc" | "desc";
}

export interface FileTableColumnMeta {
  className?: string;
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
  layoutKey: string;
  isLoading: boolean;
  getRowId: (row: T) => string;
  sort: DataTableSort;
  onSort: (field: string) => void;
  dndId?: string;
  children: ReactNode;
  skeleton?: ReactNode;
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

type FileTableColumnSizes = Record<string, number>;

/**
 * Body rows carry no widths: fixed layout takes every column's width from the
 * header row.
 */
interface DataTableBodyContextValue<T extends RowData> {
  rows: Row<FileTableFeatures, T>[];
  columnOrder: string[];
  colSpan: number;
}

const DataTableBodyContext =
  createContext<DataTableBodyContextValue<Record<string, unknown>> | null>(null);

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
  size: number | undefined;
  widthSetting: number | undefined;
  isResizing: boolean;
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
    "--drag-transform": CSS.Translate.toString(transform),
    transition,
  } as CSSProperties;

  const isFirst = header.index === 0;
  const className = clsx(
    // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
    meta?.headerClassName ?? (isFirst ? "pl-6" : "pl-2"),
    // eslint-disable-next-line shadcn/require-static-classes -- column classes come from TanStack column meta, authored as static strings in the column definitions
    meta?.className ?? "",
    "relative w-(--col-size) max-w-(--col-size) min-w-(--col-size) transform-(--drag-transform) whitespace-nowrap",
    // No z-index at rest: a positioned cell with one is a stacking context, so
    // the next cell's opaque background would paint over this cell's half of
    // the resize handle.
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
        // A child of the cell, not its content box, so it spans the full header
        // height; the last column's hit area stays inside so the table does not
        // overflow its scroll box.
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
  // Explicit memo: the compiler leaves this unmemoized and a new array
  // re-renders every row.
  // Keyed on serialized ids because any layout save re-parses storage and
  // yields a new `order` array.
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
  const [liveColumnSizing, setLiveColumnSizing] = useState<
    Record<string, number>
  >({});
  const columnSizing = { ...tableLayout.widths, ...liveColumnSizing };
  // Pointer drags bypass the TanStack sizing state, which only receives
  // keyboard steps and double-click resets; getSize() clamps those to
  // minSize/maxSize.
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

  useEffect(() => {
    const { resized, reset } = pendingWidthCommitRef.current;
    if (resized.size === 0 && reset.size === 0) return;
    const resizedIds = [...resized];
    const resetIds = [...reset];
    resized.clear();
    reset.clear();
    updateTableLayout((current) => {
      const widths: Record<string, number> = { ...current.widths };
      for (const columnId of resizedIds) {
        const column = table.getColumn(columnId);
        if (column) widths[columnId] = Math.round(column.getSize());
      }
      for (const columnId of resetIds) Reflect.deleteProperty(widths, columnId);
      return { widths: Object.keys(widths).length > 0 ? widths : undefined };
    });
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
  // whose computation spans a hook call.
  const columnSizes: FileTableColumnSizes = Object.fromEntries(
    table.getAllFlatColumns().map((col) => [col.id, col.getSize()]),
  );

  // Only columns the browser lays out take part: `hidden md:table-cell` hides
  // Owner, Created and Type on narrow screens, and those keep their saved
  // widths.
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
          updateTableLayout((current) => ({
            widths: { ...current.widths, ...committed },
          }));
        }
        setPointerResize(null);
      },
    });
    if (started) setPointerResize({ columnId });
  };

  // Separate values so the body context is cached on them and keeps its
  // identity through a resize (`table` changes on every state update).
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
        // A drag outruns its handle when the column stops at its minimum or
        // maximum width, so the resize cursor stays until release.
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
        {/* No min-w-max: Chrome gives a fixed-layout table with a percentage
            width a near-infinite max-content width. */}
        <div className="relative">
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

export const DataTable = forwardRef(DataTableInner) as <T extends RowData>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle> },
) => React.ReactElement;
