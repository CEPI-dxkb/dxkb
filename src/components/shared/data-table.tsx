"use client";

import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  FlexRender,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type CellContext,
  type ColumnDef,
  type PaginationState,
  type ReactTable,
  type Row as TanStackRow,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
} from "@tanstack/react-table";

import Link from "next/link";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { getIdField } from "@/constants/resources";
import {
  classifyHref,
  resolveLink,
} from "@/components/detail-panel/metadata-link-policy";
import {
  computeShiftRangeIds,
  estimateHeaderWidth,
  formatCellValue,
} from "./data-table-utils";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";

import { Table, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableControls } from "./data-table-controls";
import { DataTableFooter } from "./data-table-footer";
import { DataTableHeader } from "./data-table-header";
import { resizeColumns, type ColumnResizeStart } from "./column-resize";
import { followPointer } from "./pointer-drag";
import { clsx } from "cn";

export function DataTable(props: DataTableProps) {
  "use no memo";
  const [sizingByKey, setSizingByKey] = useState<
    Record<string, Record<string, number>>
  >({});
  const columnsKey = props.columns
    .map(({ id, label }) => `${id}:${label}`)
    .join("|");
  return (
    <DataTableReset
      key={`${props.resource}:${columnsKey}`}
      props={props}
      sizingByKey={sizingByKey}
      setSizingByKey={setSizingByKey}
    />
  );
}

function DataTableReset({
  props,
  sizingByKey,
  setSizingByKey,
}: {
  props: DataTableProps;
  sizingByKey: Record<string, Record<string, number>>;
  setSizingByKey: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, number>>>
  >;
}) {
  "use no memo";
  return useDataTableContent(props, sizingByKey, setSizingByKey);
}

const skeletonWidthPcts = [60, 80, 50, 75, 90, 45, 70];

const emptyColumnSizing: Record<string, number> = {};

export type DataTableRow = Record<string, unknown>;

export interface DataTableColumn {
  id: string;
  label: string;
  visible?: boolean;
  sortable?: boolean;
  href?: (row: DataTableRow) => string | undefined;
  fallbackValue?: (row: DataTableRow) => unknown;
  valueHref?: string;
}

interface DataTableMeta {
  idField: string;
  isAllPagesSelected: boolean;
  lastSelectedIdRef: React.RefObject<string | null>;
  onActiveRowChange?: (id: string | null) => void;
  onAllPagesSelectionChange?: (selected: boolean) => void;
  onGenomeSelect?: (id: string | null) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  totalItems: number;
}

const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  rowSelectionFeature,
  tableMeta: metaHelper<DataTableMeta>(),
});

type DataTableFeatures = typeof dataTableFeatures;
type DataRow = DataTableRow;
export type DataTableInstance = ReactTable<DataTableFeatures, DataRow>;

export type ColumnWidths = Record<string, number>;

export type ColumnSizes = Record<string, { size: string; grow: string }>;

/**
 * Must equal the last cell's `last:mr-2` margin, which leaves this much room
 * after it.
 */
const handleOverhang = 8;

function getTableMeta(table: TanStackTable<DataTableFeatures, DataRow>) {
  const meta = table.options.meta;
  if (!meta) throw new Error("DataTable metadata is required");
  return meta;
}

function toggleRowSelection(
  row: TanStackRow<DataTableFeatures, DataRow>,
  table: TanStackTable<DataTableFeatures, DataRow>,
  shiftKey: boolean,
) {
  const meta = getTableMeta(table);
  const anchorId = meta.lastSelectedIdRef.current;

  if (shiftKey && anchorId && anchorId !== row.id) {
    const rangeIds = computeShiftRangeIds(
      table.getRowModel().rows,
      anchorId,
      row.id,
    );
    if (rangeIds.length > 0) {
      table.setRowSelection((previous) => {
        const next = { ...previous };
        for (const id of rangeIds) next[id] = true;
        return next;
      });
      return;
    }
  }

  meta.lastSelectedIdRef.current = row.id;
  const wasSelected = row.getIsSelected();
  table.setRowSelection((previous) => {
    const next = { ...previous };
    if (wasSelected) Reflect.deleteProperty(next, row.id);
    else next[row.id] = true;
    return next;
  });

  const idValue = row.original[meta.idField] ?? row.original.genome_id ?? null;
  if (wasSelected) {
    meta.onGenomeSelect?.(null);
    meta.onActiveRowChange?.(null);
  } else if (typeof idValue === "string" || typeof idValue === "number") {
    meta.onGenomeSelect?.(String(idValue));
    meta.onActiveRowChange?.(String(idValue));
  }
}

/**
 * React dispatches a checkbox's `onChange` from its `click`, so the native
 * event is that MouseEvent.
 */
function shiftKeyOf(nativeEvent: Event) {
  return "shiftKey" in nativeEvent && nativeEvent.shiftKey === true;
}

function SelectionCell({
  row,
  table,
  selected,
}: CellContext<DataTableFeatures, DataRow> & { selected: boolean }) {
  return (
    <div className="flex size-full items-center justify-center">
      <input
        type="checkbox"
        aria-label={`Select row ${row.id}`}
        checked={selected}
        onChange={(event) => {
          const current = currentRow(table, row.id);
          if (current) {
            toggleRowSelection(current, table, shiftKeyOf(event.nativeEvent));
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="m-0 cursor-pointer p-0"
      />
    </div>
  );
}

function SelectionHeader({
  table,
}: {
  table: TanStackTable<DataTableFeatures, DataRow>;
}) {
  // The header context passes the core table, which useTable creates once;
  // compiled, the checkbox would never leave its first state, so this opts out
  // like DataTableHeader.
  "use no memo";
  const meta = getTableMeta(table);
  const allPageRowsSelected = table.getIsAllPageRowsSelected();
  const somePageRowsSelected = table.getIsSomePageRowsSelected();
  const isChecked = meta.isAllPagesSelected || allPageRowsSelected;
  const isIndeterminate =
    !meta.isAllPagesSelected && somePageRowsSelected && !allPageRowsSelected;
  const selectionLabel = meta.isAllPagesSelected
    ? "Deselect all results"
    : allPageRowsSelected
      ? "Deselect all rows on this page"
      : "Select all rows on this page";

  return (
    <div className="relative flex size-full items-center justify-center">
      <input
        type="checkbox"
        aria-label={selectionLabel}
        checked={isChecked}
        ref={(element) => {
          if (element) element.indeterminate = isIndeterminate;
        }}
        onChange={(event) => {
          event.stopPropagation();
          if (meta.isAllPagesSelected) {
            meta.onAllPagesSelectionChange?.(false);
            table.toggleAllRowsSelected(false);
            if (meta.onRowSelectionChange) {
              meta.onRowSelectionChange({});
            } else {
              table.setRowSelection({});
            }
          } else {
            table.toggleAllRowsSelected(!allPageRowsSelected);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="m-0 cursor-pointer p-0"
        title={selectionLabel}
      />
      {meta.isAllPagesSelected && (
        <div className="absolute -bottom-5 left-1/2 z-50 -translate-x-1/2 transform text-3xs whitespace-nowrap text-info">
          All {meta.totalItems} selected
        </div>
      )}
    </div>
  );
}

function TableValueLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const classification = classifyHref(href);
  const stopRowNavigation = (event: React.MouseEvent) => {
    event.stopPropagation();
  };
  if (classification === "external") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={stopRowNavigation}
      >
        {children}
      </a>
    );
  }
  if (classification === "internal") {
    return (
      <Link
        href={href}
        prefetch={false}
        className={className}
        onClick={stopRowNavigation}
      >
        {children}
      </Link>
    );
  }
  return null;
}

function createColumnDefs(columns: DataTableColumn[]) {
  const definitions: ColumnDef<DataTableFeatures, DataRow>[] = [
    {
      id: "__select__",
      header: ({ table }) => <SelectionHeader table={table} />,
      cell: (context) => (
        <SelectionCell {...context} selected={context.row.getIsSelected()} />
      ),
      enableResizing: false,
      size: 32,
    },
  ];

  for (const column of columns) {
    definitions.push({
      accessorKey: column.id,
      header: column.label,
      cell: (info: CellContext<DataTableFeatures, DataRow>) => {
        const rawValue = info.getValue();
        const displayValue =
          rawValue ?? column.fallbackValue?.(info.row.original);
        const value = formatCellValue(displayValue);
        const href = column.href?.(info.row.original);
        const valueHref = column.valueHref;
        if (valueHref && Array.isArray(rawValue)) {
          return (
            <span className="flex min-w-0 scrollbar-none gap-x-2 overflow-x-auto whitespace-nowrap">
              {[...new Set(rawValue.map(String))].map((itemValue) => {
                const itemHref = resolveLink(
                  valueHref,
                  { ...info.row.original, [column.id]: itemValue },
                  column.id,
                );
                return itemHref ? (
                  <TableValueLink
                    key={itemValue}
                    href={itemHref}
                    className="shrink-0 text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-link"
                  >
                    {itemValue}
                  </TableValueLink>
                ) : (
                  <span key={itemValue} className="shrink-0">
                    {itemValue}
                  </span>
                );
              })}
            </span>
          );
        }
        const scalarValueHref = valueHref
          ? resolveLink(
              valueHref,
              { ...info.row.original, [column.id]: displayValue },
              column.id,
            )
          : undefined;
        const cellHref = scalarValueHref ?? href;
        return cellHref && classifyHref(cellHref) !== "unsafe" ? (
          <TableValueLink
            href={cellHref}
            className="truncate text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-link"
          >
            {value as React.ReactNode}
          </TableValueLink>
        ) : (
          (value as React.ReactNode)
        );
      },
      size: estimateHeaderWidth(column.label),
      enableResizing: true,
      enableSorting: column.sortable !== false,
      sortFn: (
        rowA: TanStackRow<DataTableFeatures, DataRow>,
        rowB: TanStackRow<DataTableFeatures, DataRow>,
        columnId: string,
      ) => {
        const a = rowA.getValue<unknown>(columnId);
        const b = rowB.getValue<unknown>(columnId);
        const aIsEmpty = a === undefined || a === null || a === "";
        const bIsEmpty = b === undefined || b === null || b === "";
        if (aIsEmpty && bIsEmpty) return 0;
        if (aIsEmpty) return 1;
        if (bIsEmpty) return -1;
        return a > b ? 1 : a < b ? -1 : 0;
      },
    });
  }

  return definitions;
}

export interface DataTableProps {
  id: string;
  data: DataTableRow[];
  columns: DataTableColumn[];
  totalItems: number;
  resource: string;
  idField?: string;
  errorMessage?: string;
  emptyMessage?: string;
  onSelectionChange?: (rows: Record<string, unknown>[]) => void;
  onGenomeSelect?: (id: string | null) => void;
  selectedIds?: string[];

  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (pageIndex: number) => void;

  sorting?: SortingState;
  onSortingChange?: (newSorting: SortingState) => void;

  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;

  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (newVis: Record<string, boolean>) => void;

  /**
   * Saved widths must arrive before the first non-empty `data`, since columns
   * are measured once per data set.
   */
  savedColumnWidths?: Record<string, number>;
  onColumnWidthsCommit?: (widths: Record<string, number>) => void;

  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;

  /**
   * Offer "Select all N results across all pages" once a page is fully
   * selected; turn off when the owner holds every row.
   */
  crossPageSelection?: boolean;
  isAllPagesSelected?: boolean;
  onAllPagesSelectionChange?: (selected: boolean) => void;
  totalSelectedCount?: number;

  onDownloadAll?: (
    format: "csv" | "txt",
    visibleColumns: string[] | null,
  ) => void | Promise<void>;
  onDownloadSelected?: (
    format: "csv" | "txt",
    selectedIds: string[],
    visibleColumns: string[] | null,
  ) => void | Promise<void>;
  showExportControls?: boolean;
  hideColumnControls?: boolean;
  scrollRegionLabel?: string;
  isLoading?: boolean;
  /**
   * Rows from a previous query stay on screen, dimmed and busy, under a loading
   * notice; `isLoading` wins.
   */
  isRefreshing?: boolean;

  onActiveRowChange?: (id: string | null) => void;
}

function useDataTableContent(
  {
    id: _id,
    data,
    columns,
    totalItems,
    resource,
    idField: explicitIdField,
    errorMessage,
    emptyMessage,
    onSelectionChange,
    onGenomeSelect,
    selectedIds,
    pageIndex,
    pageSize,
    onPageChange,
    sorting: controlledSorting,
    onSortingChange,
    columnOrder,
    onColumnOrderChange,
    columnVisibility: controlledVisibility,
    onColumnVisibilityChange: onColumnVisibilityChangeProp,
    savedColumnWidths,
    onColumnWidthsCommit,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    crossPageSelection = true,
    isAllPagesSelected = false,
    onAllPagesSelectionChange,
    totalSelectedCount,
    onDownloadAll,
    onDownloadSelected,
    showExportControls = true,
    hideColumnControls = false,
    scrollRegionLabel,
    isLoading = false,
    isRefreshing = false,
    onActiveRowChange,
  }: DataTableProps,
  sizingByKey: Record<string, Record<string, number>>,
  setSizingByKey: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, number>>>
  >,
) {
  "use no memo";

  // Column sizing is kept per resource+columns: gating on the key means shared
  // column IDs never inherit another resource's widths, and a revisited tab
  // reuses its own.
  const sizingKey = `${resource}:${columns.map((c) => c.id).join(",")}`;
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const columnVisibility = controlledVisibility ?? internalColumnVisibility;

  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const rowSelection =
    controlledRowSelection !== undefined
      ? controlledRowSelection
      : internalRowSelection;

  const [internalPagination, setInternalPagination] = useState<PaginationState>(
    () => ({
      pageIndex: pageIndex ?? 0,
      pageSize: pageSize ?? 200,
    }),
  );
  const pagination = {
    pageIndex: pageIndex ?? internalPagination.pageIndex,
    pageSize: pageSize ?? internalPagination.pageSize,
  };

  const idField = explicitIdField ?? getIdField(resource);

  const lastSelectedIdRef = useRef<string | null>(null);

  // State rather than a ref so the body re-renders once it exists: React runs
  // the body's layout effects before this component's ref attaches, so a ref
  // would be null when the virtualizer looks for its scroll element.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  const initialColumnSizing = savedColumnWidths ?? emptyColumnSizing;
  const activeColumnSizing = sizingByKey[sizingKey] ?? initialColumnSizing;
  const measuredSizingKeysRef = useRef(new Set<string>());
  const pendingWidthCommitRef = useRef(new Set<string>());
  useEffect(() => {
    if (
      measuredSizingKeysRef.current.has(sizingKey) ||
      columns.length === 0 ||
      data.length === 0
    )
      return;
    measuredSizingKeysRef.current.add(sizingKey);
    const autoSizes = computeAutoColumnSizes(columns, data);
    const next: Record<string, number> = {};
    for (const col of columns) {
      next[col.id] =
        savedColumnWidths?.[col.id] ??
        Math.max(estimateHeaderWidth(col.label), autoSizes[col.id] ?? 0);
    }
    setSizingByKey((current) => ({ ...current, [sizingKey]: next }));
  }, [columns, data, sizingKey, savedColumnWidths, setSizingByKey]);

  const [columnDefs] = useState(() => createColumnDefs(columns));

  // Keep this options object a fresh literal per render:
  // DataTableHeader/Controls/Footer are "use no memo" because they key derived
  // values off `table` identity, and memoizing it would freeze them.
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: columnDefs,
    defaultColumn: {
      minSize: 40,
      maxSize: 1000,
    },
    meta: {
      idField,
      isAllPagesSelected,
      lastSelectedIdRef,
      onActiveRowChange,
      onAllPagesSelectionChange,
      onGenomeSelect,
      onRowSelectionChange,
      totalItems,
    } satisfies DataTableMeta,
    state: {
      sorting: controlledSorting ?? [],
      pagination,
      ...(columnOrder !== undefined && { columnOrder }),
      columnVisibility,
      columnSizing: activeColumnSizing,
      rowSelection,
    },
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;

      if (isAllPagesSelected) {
        onAllPagesSelectionChange?.(false);
      }

      if (onRowSelectionChange) {
        onRowSelectionChange(newSelection);
      } else {
        setInternalRowSelection(newSelection);
      }

      if (onSelectionChange) {
        const selectedRows: Record<string, unknown>[] = [];
        for (const row of table.getRowModel().rows) {
          if (row.id in newSelection) selectedRows.push(row.original);
        }
        onSelectionChange(selectedRows);
      }
    },

    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function"
          ? updater(controlledSorting ?? [])
          : updater;

      table.setPageIndex(0);

      onSortingChange?.(newSorting);
    },

    onColumnVisibilityChange: (updater) => {
      const newVis =
        typeof updater === "function" ? updater(columnVisibility) : updater;

      if (controlledVisibility === undefined) {
        setInternalColumnVisibility(newVis);
      }

      if (onColumnVisibilityChangeProp) {
        onColumnVisibilityChangeProp(newVis);
      }

      setSizingByKey((prev) => {
        const base = { ...(prev[sizingKey] ?? {}) };
        table.getAllLeafColumns().forEach((col) => {
          if (!base[col.id]) {
            base[col.id] = col.getSize();
          }
        });
        return { ...prev, [sizingKey]: base };
      });
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;

      setInternalPagination(next);

      onPageChange?.(next.pageIndex);
    },
    onColumnOrderChange: onColumnOrderChange
      ? (updater) => {
          const newOrder =
            typeof updater === "function"
              ? updater(columnOrder ?? [])
              : updater;

          onColumnOrderChange(newOrder);
        }
      : undefined,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(totalItems / pagination.pageSize),
    enableColumnResizing: true,
    onColumnSizingChange: (updater) => {
      setSizingByKey((prev) => {
        const base = prev[sizingKey] ?? initialColumnSizing;
        const next = typeof updater === "function" ? updater(base) : updater;
        for (const [columnId, width] of Object.entries(next)) {
          if (base[columnId] !== width) {
            pendingWidthCommitRef.current.add(columnId);
          }
        }
        return { ...prev, [sizingKey]: next };
      });
    },
    enableRowSelection: true,
    enableRowRangeSelection: false,
    enableSortingRemoval: false,
    enableMultiRowSelection: true,
    getRowId: (row) => String(row[idField]),
  });

  const [pointerResize, setPointerResize] = useState<{
    columnId: string;
    widths?: ColumnWidths;
    settings?: ColumnWidths;
  } | null>(null);
  const resizingColumnId = pointerResize?.columnId;

  useEffect(() => {
    if (!onColumnWidthsCommit) return;
    const pending = pendingWidthCommitRef.current;
    if (pending.size === 0) return;
    pendingWidthCommitRef.current = new Set();
    const widths: Record<string, number> = {};
    for (const columnId of pending) {
      const column = table.getColumn(columnId);
      if (column) widths[columnId] = Math.round(column.getSize());
    }
    if (Object.keys(widths).length > 0) onColumnWidthsCommit(widths);
  });

  // The browser does the column stretch, not React: rows are flex rows and a
  // resting resizable cell is `--col-size` wide with a flex-grow of the same
  // setting, so spare room is shared in proportion.
  // Recomputing widths in React cost a ~100 ms commit per frame while the view
  // rail animates.
  // The last cell's `last:mr-2` stops the stretch `handleOverhang` short of the
  // edge, so filling the box exactly does not add a phantom scrollbar.
  const columnSizes: ColumnSizes = {};
  for (const { column } of table.getFlatHeaders()) {
    const dragged = pointerResize?.widths?.[column.id];
    const size = dragged ?? column.getSize();
    columnSizes[column.id] = {
      size: `${String(size)}px`,
      grow: String(dragged === undefined && column.getCanResize() ? size : 0),
    };
  }

  const startPointerResize = (
    columnId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const leafColumns = table.getVisibleLeafColumns();
    const index = leafColumns.findIndex((column) => column.id === columnId);
    if (index === -1) return;
    const start: ColumnResizeStart = {
      columnIds: leafColumns.map((c) => c.id),
      sizes: leafColumns.map((c) => c.getSize()),
      minSizes: leafColumns.map((c) => c.columnDef.minSize ?? 40),
      maxSizes: leafColumns.map((c) => c.columnDef.maxSize ?? 1000),
      fixed: leafColumns.map((c) => !c.getCanResize()),
      index,
      containerWidth: Math.max(
        0,
        (scrollElement?.clientWidth ?? 0) - handleOverhang,
      ),
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
          setSizingByKey((prev) => ({
            ...prev,
            [sizingKey]: {
              ...(prev[sizingKey] ?? initialColumnSizing),
              ...committed,
            },
          }));
          onColumnWidthsCommit?.(committed);
        }
        setPointerResize(null);
      },
    });
    if (started) setPointerResize({ columnId });
  };

  const rows = table.getRowModel().rows;

  // Skeleton row count is an upper bound from window.innerHeight (the
  // container's height is unknown at first render, and overflow-hidden clips
  // the surplus).
  // Reading window during render would break SSR hydration, so start from a
  // fixed fallback and bump it in a mount effect.
  const [skeletonRowCount, setSkeletonRowCount] = useState(30);
  useEffect(() => {
    const update = () => {
      setSkeletonRowCount(Math.ceil(window.innerHeight / 24));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden border-0 text-xs">
      {crossPageSelection &&
        !isAllPagesSelected &&
        table.getIsAllPageRowsSelected() && (
          <div className="mb-2 flex w-full items-center justify-between border border-info/20 bg-info/5 px-4 py-2">
            <span className="text-info">
              All {data.length} results on this page are selected.
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAllPagesSelectionChange?.(true);
              }}
              className="cursor-pointer font-semibold text-info underline hover:text-foreground"
            >
              Select all {totalItems} results across all pages
            </button>
          </div>
        )}
      {crossPageSelection && isAllPagesSelected && (
        <div className="mb-2 w-full border border-info/30 bg-info/10 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-info">
              All {totalItems} results are selected across all pages.
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onAllPagesSelectionChange?.(false);
                table.toggleAllRowsSelected(false);
                if (onRowSelectionChange) {
                  onRowSelectionChange({});
                }
              }}
              className="cursor-pointer text-info underline hover:text-foreground"
            >
              Clear selection
            </button>
          </div>
          <div className="mt-1 text-xs text-info">
            Note: Checkboxes on other pages may not appear checked for
            performance reasons, but all rows are selected.
          </div>
        </div>
      )}
      {!hideColumnControls && (
        <DataTableControls
          table={table}
          resource={resource}
          selectedIds={selectedIds}
          isAllPagesSelected={isAllPagesSelected}
          onDownloadAll={onDownloadAll}
          onDownloadSelected={onDownloadSelected}
          showExportControls={showExportControls}
        />
      )}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded border border-border">
        {isRefreshing && !isLoading && (
          // Not a live region: the owner announces the refresh (see
          // ResourceCollection).
          <div className="pointer-events-none absolute top-12 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Loading results...
          </div>
        )}
        <div
          className={clsx(
            "relative max-h-full flex-1",
            isLoading ? "overflow-hidden" : "overflow-auto",
            // A drag outruns its handle when the column stops at its minimum or
            // maximum width, so keep the resize cursor until release.
            resizingColumnId &&
              "cursor-col-resize select-none **:cursor-col-resize",
          )}
          ref={setScrollElement}
          role="region"
          aria-label={scrollRegionLabel ?? `${resource} results`}
          aria-busy={isLoading || undefined}
          tabIndex={0}
        >
          <div className="relative min-w-max">
            <Table
              size="xs"
              className="relative w-full table-auto border-collapse"
              disableScrollWrapper={true}
            >
              <DataTableHeader
                table={table}
                columnSizes={columnSizes}
                onColumnOrderChange={onColumnOrderChange}
                resizingColumnId={resizingColumnId}
                widthSettings={pointerResize?.settings}
                onResizeStart={startPointerResize}
              />

              <DataTableBody
                table={table}
                columnSizes={columnSizes}
                rows={rows}
                scrollElement={scrollElement}
                idField={idField}
                lastSelectedIdRef={lastSelectedIdRef}
                onGenomeSelect={onGenomeSelect}
                onActiveRowChange={onActiveRowChange}
                errorMessage={errorMessage}
                emptyMessage={emptyMessage}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                skeletonRowCount={skeletonRowCount}
              />
            </Table>
          </div>
        </div>

        <DataTableFooter
          table={table}
          resource={resource}
          totalItems={totalItems}
          dataLength={data.length}
          isLoading={isLoading}
          isAllPagesSelected={isAllPagesSelected}
          totalSelectedCount={totalSelectedCount}
        />
      </div>
    </div>
  );
}

interface DataTableBodyProps {
  table: ReactTable<DataTableFeatures, DataRow>;
  columnSizes: ColumnSizes;
  rows: TanStackRow<DataTableFeatures, DataRow>[];
  scrollElement: HTMLDivElement | null;
  idField: string;
  lastSelectedIdRef: React.RefObject<string | null>;
  onGenomeSelect?: (id: string | null) => void;
  onActiveRowChange?: (id: string | null) => void;
  errorMessage?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  skeletonRowCount?: number;
}

interface BodyRowLatest {
  table: ReactTable<DataTableFeatures, DataRow>;
  scrollElement: HTMLDivElement | null;
  idField: string;
  lastSelectedIdRef: React.RefObject<string | null>;
  onGenomeSelect?: (id: string | null) => void;
  onActiveRowChange?: (id: string | null) => void;
}

interface BodyRowHandlers {
  onRowClick: (rowId: string, event: React.MouseEvent<HTMLElement>) => void;
  onSelectCellClick: (
    rowId: string,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  onRowMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
}

function isCheckboxTarget(event: React.MouseEvent<HTMLElement>) {
  return (event.target as HTMLElement).closest('input[type="checkbox"]') !== null;
}

const pressFocusableSelector =
  "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]";

function pressFocusTarget(
  event: React.MouseEvent<HTMLElement>,
  scrollElement: HTMLElement | null,
): HTMLElement | null {
  const control = (event.target as Element).closest<HTMLElement>(
    pressFocusableSelector,
  );
  return control && event.currentTarget.contains(control)
    ? control
    : scrollElement;
}

/**
 * A transition can hand the table new data and then suspend, leaving the old
 * rows on screen to be clicked.
 */
function currentRow(
  table: TanStackTable<DataTableFeatures, DataRow>,
  rowId: string,
): TanStackRow<DataTableFeatures, DataRow> | undefined {
  return table.getRowModel().rowsById[rowId];
}

/**
 * Created once per body so memoized rows never re-render for a new handler;
 * they read the live table and row via `latestRef` because a memoized row can
 * hold a stale row object.
 */
function createBodyRowHandlers(
  latestRef: React.RefObject<BodyRowLatest>,
): BodyRowHandlers {
  return {
    // A click from a checkbox is left to the checkbox, which already calls
    // onActiveRowChange/onGenomeSelect.
    onRowClick: (rowId, event) => {
      if (isCheckboxTarget(event)) return;
      const {
        table,
        idField,
        lastSelectedIdRef,
        onGenomeSelect,
        onActiveRowChange,
      } = latestRef.current;
      const row = currentRow(table, rowId);
      if (!row) return;
      const anchorId = lastSelectedIdRef.current;

      if (event.shiftKey && anchorId) {
        const rangeIds = computeShiftRangeIds(
          table.getRowModel().rows,
          anchorId,
          rowId,
        );
        if (rangeIds.length > 0) {
          const next: RowSelectionState = {};
          for (const rid of rangeIds) next[rid] = true;
          table.setRowSelection(next);
          return;
        }
      }

      lastSelectedIdRef.current = rowId;

      if (event.ctrlKey || event.metaKey) {
        row.toggleSelected();
      } else {
        table.setRowSelection({ [rowId]: true });
      }

      const idVal = row.original[idField] ?? row.original["genome_id"] ?? null;
      if (
        idVal != null &&
        (typeof idVal === "string" || typeof idVal === "number")
      ) {
        onGenomeSelect?.(String(idVal));
        onActiveRowChange?.(String(idVal));
      }
    },
    onSelectCellClick: (rowId, event) => {
      event.stopPropagation();
      if (isCheckboxTarget(event)) return;
      const { table } = latestRef.current;
      const row = currentRow(table, rowId);
      if (row) toggleRowSelection(row, table, event.shiftKey);
    },
    // Preventing the default stops the press from moving focus, so focus what a
    // plain press would, without scrolling.
    onRowMouseDown: (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        pressFocusTarget(event, latestRef.current.scrollElement)?.focus({
          preventScroll: true,
        });
      }
    },
  };
}

interface DataTableBodyRowProps extends BodyRowHandlers {
  row: TanStackRow<DataTableFeatures, DataRow>;
  rowId: string;
  original: DataRow;
  selected: boolean;
  start: number;
  columnSizes: ColumnSizes;
  columnSignature: string;
}

/**
 * A row re-renders only when its data, selection, position or `columnSignature`
 * changes; it ignores `columnSizes` (a fresh object each render), the handlers,
 * and `row` (whose output those props already cover).
 */
function areBodyRowPropsEqual(
  previous: DataTableBodyRowProps,
  next: DataTableBodyRowProps,
) {
  return (
    previous.rowId === next.rowId &&
    previous.original === next.original &&
    previous.selected === next.selected &&
    previous.start === next.start &&
    previous.columnSignature === next.columnSignature
  );
}

const DataTableBodyRow = memo(function DataTableBodyRow({
  row,
  rowId,
  selected,
  start,
  columnSizes,
  onRowClick,
  onSelectCellClick,
  onRowMouseDown,
}: DataTableBodyRowProps) {
  // Compiled, row.getVisibleCells() would be cached on `row`, which stays the
  // same object after a column is hidden or reordered.
  "use no memo";
  return (
    <TableRow
      onClick={(event) => {
        onRowClick(rowId, event);
      }}
      onMouseDown={onRowMouseDown}
      style={
        {
          "--row-start": `${String(start)}px`,
        } as CSSProperties
      }
      variant="tint"
      data-state={selected ? "selected" : undefined}
      className="group absolute inset-x-0 flex h-6 translate-y-(--row-start) cursor-pointer"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          onClick={
            cell.column.id === "__select__"
              ? (event) => {
                  onSelectCellClick(rowId, event);
                }
              : undefined
          }
          // The sticky select cell needs an opaque background so scrolled cells
          // do not show through; see TableCell `sticky-select`.
          variant={cell.column.id === "__select__" ? "sticky-select" : "grid"}
          className={clsx(
            // No ellipsis: text-overflow has no effect on a flex container, so
            // overflow-hidden is all `truncate` did.
            "flex h-6 w-(--col-size) min-w-(--col-size) grow-(--col-grow) items-center overflow-hidden last:mr-2",
            cell.column.id === "__select__"
              ? "sticky left-0 z-1 justify-center p-0"
              : "justify-start p-0.5",
          )}
          style={
            {
              "--col-size": columnSizes[cell.column.id].size,
              "--col-grow": columnSizes[cell.column.id].grow,
            } as CSSProperties
          }
        >
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  );
}, areBodyRowPropsEqual);

function DataTableBody({
  table,
  columnSizes,
  rows,
  scrollElement,
  idField,
  lastSelectedIdRef,
  onGenomeSelect,
  onActiveRowChange,
  errorMessage,
  emptyMessage = "No results",
  isLoading = false,
  isRefreshing = false,
  skeletonRowCount = 20,
}: DataTableBodyProps) {
  "use no memo";
  // useFlushSync stays at its default (true): false would defer the render past
  // the scroll frame and flash blank rows on a fast scroll.
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 24,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const latestRef = useRef<BodyRowLatest>({
    table,
    scrollElement,
    idField,
    lastSelectedIdRef,
    onGenomeSelect,
    onActiveRowChange,
  });
  useLayoutEffect(() => {
    latestRef.current = {
      table,
      scrollElement,
      idField,
      lastSelectedIdRef,
      onGenomeSelect,
      onActiveRowChange,
    };
  });
  // Created once: the body is opted out of the compiler, and the memoized rows
  // compare on this identity.
  const [handlers] = useState(() => createBodyRowHandlers(latestRef));

  // Integer-like column ids ("1", "2") iterate in numeric order whatever the
  // header order.
  const columnSignature = table
    .getFlatHeaders()
    .map(({ column }) => {
      const { size, grow } = columnSizes[column.id];
      return `${column.id}:${size}:${grow}`;
    })
    .join("|");

  return (
    <TableBody
      aria-busy={isRefreshing && !isLoading ? true : undefined}
      style={{ "--body-height": `${String(totalSize)}px` } as CSSProperties}
      className={clsx(
        "relative z-10 border-collapse",
        // Fill the container while loading so the absolute skeleton rows have a
        // full-height positioning context.
        isLoading ? "h-full" : "h-(--body-height)",
      )}
    >
      {isLoading ? (
        Array.from({ length: skeletonRowCount }, (_, rowIdx) => (
          <TableRow
            key={rowIdx}
            className="absolute top-(--row-top) flex h-6 w-full"
            style={{ "--row-top": `${String(rowIdx * 24)}px` } as CSSProperties}
          >
            {table.getVisibleLeafColumns().map((col, colIdx) => (
              <TableCell
                key={col.id}
                variant="grid"
                className={clsx(
                  "flex h-6 w-(--col-size) min-w-(--col-size) grow-(--col-grow) items-center last:mr-2",
                  col.id === "__select__" ? "justify-center p-0" : "p-0.5",
                )}
                style={
                  {
                    "--col-size": columnSizes[col.id].size,
                    "--col-grow": columnSizes[col.id].grow,
                  } as CSSProperties
                }
              >
                {col.id === "__select__" ? (
                  <Skeleton className="size-3.5 rounded-sm" />
                ) : (
                  <Skeleton
                    className="h-3 w-(--skeleton-width) rounded"
                    style={
                      {
                        "--skeleton-width": `${String(skeletonWidthPcts[(rowIdx * 7 + colIdx) % skeletonWidthPcts.length])}%`,
                      } as CSSProperties
                    }
                  />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : rows.length === 0 ? (
        <TableRow className="flex h-6 w-full items-center">
          <TableCell
            colSpan={table.getVisibleLeafColumns().length}
            className="w-full justify-start p-0.5 text-left"
          >
            {errorMessage ? (
              <span className="text-destructive">{errorMessage}</span>
            ) : (
              <span className="text-muted-foreground">{emptyMessage}</span>
            )}
          </TableCell>
        </TableRow>
      ) : (
        virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <DataTableBodyRow
              key={row.id}
              row={row}
              rowId={row.id}
              original={row.original}
              selected={row.getIsSelected()}
              start={virtualRow.start}
              columnSizes={columnSizes}
              columnSignature={columnSignature}
              onRowClick={handlers.onRowClick}
              onSelectCellClick={handlers.onSelectCellClick}
              onRowMouseDown={handlers.onRowMouseDown}
            />
          );
        })
      )}
    </TableBody>
  );
}

function computeAutoColumnSizes(
  columns: DataTableColumn[],
  data: Record<string, unknown>[],
  maxWidth = 250,
): Record<string, number> {
  if (typeof document === "undefined") return {};
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};

  const cellFont = "12px system-ui, sans-serif";
  const headerFont = "bold 12px system-ui, sans-serif";

  const sizes: Record<string, number> = {};

  // Layout overhead beyond glyph width: header th px-2 + pr-2 + sorted gap =
  // 32px, cell px-0.5 = 4px.
  const headerOverhead = 32;
  const cellOverhead = 4;

  for (const col of columns) {
    ctx.font = headerFont;
    const longestWord = col.label
      .split(/\s+/)
      .reduce(
        (a, b) =>
          ctx.measureText(a).width >= ctx.measureText(b).width ? a : b,
        "",
      );
    const effectiveHeaderWidth =
      Math.ceil(ctx.measureText(longestWord).width * 1.1) + headerOverhead;

    ctx.font = cellFont;
    let effectiveContentWidth = 0;
    for (const row of data) {
      const raw = row[col.id];
      if (raw == null) continue;
      let str: string;
      if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        const d = new Date(raw);
        str = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear())}`;
      } else if (
        typeof raw === "string" ||
        typeof raw === "number" ||
        typeof raw === "boolean"
      ) {
        str = String(raw);
      } else {
        continue;
      }
      const w = Math.ceil(ctx.measureText(str).width) + cellOverhead;
      if (w > effectiveContentWidth) effectiveContentWidth = w;
    }

    sizes[col.id] = Math.min(
      Math.max(effectiveHeaderWidth, effectiveContentWidth),
      maxWidth,
    );
  }

  return sizes;
}
