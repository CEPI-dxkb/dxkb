"use client";

import { useKeyHold } from "@tanstack/react-hotkeys";
import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
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
import { useRef, useState, useEffect, type CSSProperties } from "react";
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

import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
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

// Varied bar widths for skeleton cells so loading rows read as content, not blocks.
const skeletonWidthPcts = [60, 80, 50, 75, 90, 45, 70];

// Stable identity for the "no sizing yet" case.
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
  shiftHeldRef: React.RefObject<boolean>;
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

/** Resolved pixel width of each column, keyed by column id. */
export type ColumnWidths = Record<string, number>;

/**
 * The custom properties each header and body cell sizes itself from, keyed by
 * column id (see `columnSizes` in useDataTableContent): `size` is its
 * `--col-size` (px), `grow` its `--col-grow` (a flex-grow factor).
 */
export type ColumnSizes = Record<string, { size: string; grow: string }>;

/**
 * How far a header's resize handle reaches past the cell's right edge (px).
 * The last cell's `last:mr-2` keeps this much room after it, so it must stay
 * equal to that margin.
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
) {
  const meta = getTableMeta(table);
  const anchorId = meta.lastSelectedIdRef.current;

  if (meta.shiftHeldRef.current && anchorId && anchorId !== row.id) {
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
        onChange={() => {
          toggleRowSelection(row, table);
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
  // The column header context passes the core table, which useTable creates once.
  // Compiled, everything below would be cached on that one value and the checkbox
  // would never leave its first state (unchecked, "Select all rows on this page").
  // SelectionCell gets its state as a prop instead; this header reads several values
  // and the meta callbacks, so it opts out like DataTableHeader.
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
      <Link href={href} className={className} onClick={stopRowNavigation}>
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
  /** Shown in place of rows when there are none (and no error). */
  emptyMessage?: string;
  onSelectionChange?: (rows: Record<string, unknown>[]) => void;
  onGenomeSelect?: (id: string | null) => void;
  selectedIds?: string[];

  // Pagination
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (pageIndex: number) => void;

  // Sorting
  sorting?: SortingState;
  onSortingChange?: (newSorting: SortingState) => void;

  // column ordering
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;

  // column visibility
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (newVis: Record<string, boolean>) => void;

  // column widths
  /**
   * Widths the user set on an earlier visit, in px; they win over auto-measured sizes.
   * Columns are measured once per data set, so saved widths must arrive before the
   * first non-empty `data` (true for every caller today: rows load client-side).
   */
  savedColumnWidths?: Record<string, number>;
  /**
   * Called with the columns whose width the user changed — once per pointer drag,
   * on release, and once per keyboard step.
   */
  onColumnWidthsCommit?: (widths: Record<string, number>) => void;

  // row selection (controlled)
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;

  // Cross-page selection
  /**
   * Offer "Select all N results across all pages" once a page is fully
   * selected (default). Turn it off when the owner holds every row and the
   * selection is just the rows checked, page by page.
   */
  crossPageSelection?: boolean;
  isAllPagesSelected?: boolean;
  onAllPagesSelectionChange?: (selected: boolean) => void;
  totalSelectedCount?: number;

  // Optional download handler
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
  /**
   * The owner draws its own Columns control (`ResourceCollection`'s toolbar),
   * so the table's row of controls is left out.
   */
  hideColumnControls?: boolean;
  scrollRegionLabel?: string;
  // Loading indicator: parent can set this while data is being fetched
  isLoading?: boolean;
  /**
   * The rows handed in belong to a previous query (another sort, filter or
   * keyword on the same page) while the current one loads. They stay on screen,
   * dimmed and marked busy, under a visible loading notice. `isLoading` wins.
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

  // Column sizing kept per resource+columns. The persisted instance keeps this across
  // tab switches, so: (a) gating on the key in the render path means shared column IDs
  // never inherit another resource's widths (no stale-width frame), and (b) returning
  // to an already-sized tab reuses its widths immediately (no revisit snap).
  // resource makes shared column IDs distinct across tabs. Labels are static per
  // resource (derived from the module-level resourceFields[resource]), so id-order
  // alone pins the header estimates too — no need to include labels in the key.
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

  // Pagination state: support both controlled (via pageIndex/pageSize props)
  // and uncontrolled usage. If parent provides pageIndex/pageSize we treat
  // pagination as controlled for that value; otherwise we keep internal state
  // so actions like resizing columns don't reset the current page to 0.
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

  const shiftHeld = useKeyHold("Shift");
  const ctrlHeld = useKeyHold("Control");
  const metaHeld = useKeyHold("Meta");
  const ctrlOrCmdHeld = ctrlHeld || metaHeld;
  // Mirror shiftHeld into a ref so the memoized checkbox cell reads the live value
  // without shiftHeld entering renderCheckboxCell's deps — which would rebuild
  // columnDefs (and reconfigure the table) on every Shift press/release.
  const shiftHeldRef = useRef(false);
  useEffect(() => {
    shiftHeldRef.current = shiftHeld;
  }, [shiftHeld]);

  const lastSelectedIdRef = useRef<string | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // What the table shows before this key's data has been measured (and what a
  // resize starts from): the widths the user saved, else nothing.
  const initialColumnSizing = savedColumnWidths ?? emptyColumnSizing;
  const activeColumnSizing = sizingByKey[sizingKey] ?? initialColumnSizing;
  const measuredSizingKeysRef = useRef(new Set<string>());
  // Columns the user resized since the owner was last told; see the commit effect.
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

  // This options object MUST stay a fresh literal per render. `useTable`
  // returns a new instance whenever the options or state change, and
  // DataTableHeader/Controls/Footer are compiled with "use no memo" precisely
  // because they key derived values (sort chevrons, Prev/Next disabled state,
  // the column menu) off `table` identity. Memoizing this object would look
  // like a harmless optimisation and would silently freeze those controls.
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
      shiftHeldRef,
      totalItems,
    } satisfies DataTableMeta,
    state: {
      sorting: controlledSorting ?? [],
      // use the internal pagination state (which is kept in sync with
      // controlled props when provided). This prevents ephemeral UI
      // operations like column-resize from resetting the active page.
      pagination,
      ...(columnOrder !== undefined && { columnOrder }),
      columnVisibility,
      columnSizing: activeColumnSizing,
      rowSelection,
    },
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;

      // If any individual row selection changes, clear the "all pages selected" state
      if (isAllPagesSelected) {
        onAllPagesSelectionChange?.(false);
      }

      // If controlled, call the parent handler
      if (onRowSelectionChange) {
        onRowSelectionChange(newSelection);
      } else {
        // Otherwise update internal state
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

      // Reset to first page
      table.setPageIndex(0);

      // Notify parent (parent will handle clearing selection)
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

      // Trigger a recalculation of column sizing on visibility toggle
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

      // Preserve uncontrolled fields during interactions such as resizing.
      setInternalPagination(next);

      // Notify parent of page change (if provided)
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
        // Same fallback as activeColumnSizing, so a resize before the first
        // measurement starts from the widths actually on screen.
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
    //    getRowId: (row, index) => String((row as any).genome_id ?? `${index}`)
    getRowId: (row) => String(row[idField]),
  });

  // Rendered widths during a pointer drag (see startPointerResize), and the
  // settings the handles report meanwhile.
  const [pointerResize, setPointerResize] = useState<{
    columnId: string;
    widths?: ColumnWidths;
    settings?: ColumnWidths;
  } | null>(null);
  const resizingColumnId = pointerResize?.columnId;

  // Hand keyboard resizes to the owner as they happen (a pointer drag commits
  // itself on release). The width sent is the column's clamped getSize().
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

  // How every column's header and body cells size themselves (they re-render
  // with this component: all three carry "use no memo"). Columns stretch to
  // fill the container: when the width settings leave room, every resizable
  // column is scaled up by the same factor (`columnScale` in column-resize.ts).
  // When they already exceed the container (e.g. a column dragged very wide)
  // widths are the settings and the container scrolls horizontally.
  //
  // The browser does the stretch, not React. Header and body rows are flex
  // rows, and a resting resizable cell is `--col-size` (its setting) wide with
  // a flex-grow of that same setting, so the spare room is shared in
  // proportion to the settings: every one ends up setting × factor, and none
  // shrinks below its setting. A container resize is then layout only. The
  // view rail's collapse animation and a detail-panel drag resize the
  // container on every frame; recomputing the widths in React and rewriting
  // each visible cell's inline width instead cost a ~100 ms commit per frame in
  // dev (25–50 ms frames in prod), and a container-level scale variable still
  // restyled every cell (~13 ms per frame in prod). The last cell's `last:mr-2`
  // stops the stretch `handleOverhang` short of the edge, where the last
  // handle overhangs its cell: filling the box exactly would put a phantom
  // horizontal scrollbar under it.
  //
  // A pointer drag sets the rendered widths directly, with no grow (see
  // startPointerResize), so the dragged edge stays under the pointer; they are
  // drawn from the settings it saves on release, so nothing moves when it ends.
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
      // Short of the last handle's overhang, as the resting columns stretch.
      containerWidth: Math.max(
        0,
        (tableContainerRef.current?.clientWidth ?? 0) - handleOverhang,
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
          // Every visible column. Anything else keeps its resting size, which
          // the drag does not change until release.
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

  // Skeleton rows fill the body at any resolution. The scroll container's height
  // isn't known at first render (its ResizeObserver effect only fires once data
  // arrives), so derive an upper bound from the viewport: window.innerHeight is
  // always ≥ the table body, and the container's overflow-hidden clips surplus
  // rows — a slight overestimate fills the space with no scrollbar or gap.
  // Reading window during render would break SSR hydration, so start from a fixed
  // fallback (matches server render) and bump to the real viewport count in a
  // mount effect. The skeleton lives far longer than one frame, so the bump is
  // applied well before data lands.
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

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 24,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Now that all the setup is done, let's render the table!
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden border-0 text-xs">
      {/* This is the main container. Full width and content centered. */}
      {/* Banner for selecting all results across pages */}
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
          // ResourceCollection), and a second status would repeat it.
          <div className="pointer-events-none absolute top-12 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Loading results...
          </div>
        )}
        <div
          className={clsx(
            "relative max-h-full flex-1",
            // During load, clip the overestimated skeleton rows (no scrollbar);
            // switch to auto once real rows/virtualizer drive the height.
            isLoading ? "overflow-hidden" : "overflow-auto",
            (shiftHeld || ctrlOrCmdHeld) && "select-none",
            // A drag outruns its handle whenever the column stops at its
            // minimum or maximum width; keep the resize cursor until release.
            resizingColumnId &&
              "cursor-col-resize select-none **:cursor-col-resize",
          )}
          ref={tableContainerRef}
          role="region"
          aria-label={scrollRegionLabel ?? `${resource} results`}
          // The skeleton rows are not results: assistive tech waits for the
          // read. (A refresh marks the body busy instead, which dims it.)
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
                virtualRows={virtualRows}
                totalSize={totalSize}
                idField={idField}
                shiftHeld={shiftHeld}
                ctrlOrCmdHeld={ctrlOrCmdHeld}
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
  virtualRows: VirtualItem[];
  totalSize: number;
  idField: string;
  shiftHeld: boolean;
  ctrlOrCmdHeld: boolean;
  lastSelectedIdRef: React.RefObject<string | null>;
  onGenomeSelect?: (id: string | null) => void;
  onActiveRowChange?: (id: string | null) => void;
  errorMessage?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  skeletonRowCount?: number;
}

function DataTableBody({
  table,
  columnSizes,
  rows,
  virtualRows,
  totalSize,
  idField,
  shiftHeld,
  ctrlOrCmdHeld,
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
  return (
    <TableBody
      // TableBody dims itself while busy.
      aria-busy={isRefreshing && !isLoading ? true : undefined}
      style={{ "--body-height": `${String(totalSize)}px` } as CSSProperties}
      className={clsx(
        "relative z-10 border-collapse",
        // While loading, fill the container (height:100%) so the absolute skeleton
        // rows have a full-height positioning context. The scroll container is set
        // to overflow:hidden during load (see DataTable), so the intentionally
        // overestimated rows are clipped to reach the footer with no gap/scrollbar.
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
                  // Centered like the header and row checkboxes it stands in for.
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
        // If there ARE results...
        virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <TableRow
              key={row.id}
              // Clicking a row should notify listeners about the active row (used to open side panels).
              // If the click originated from a checkbox/input, avoid double-handling because
              // the checkbox click handler already calls onActiveRowChange/onGenomeSelect.
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('input[type="checkbox"]'))
                  return;
                const currentRowId = row.id;
                const anchorId = lastSelectedIdRef.current;

                if (shiftHeld && anchorId) {
                  // Exclusive range (replace existing selection)
                  const rangeIds = computeShiftRangeIds(
                    table.getRowModel().rows,
                    anchorId,
                    currentRowId,
                  );
                  if (rangeIds.length > 0) {
                    const next: RowSelectionState = {};
                    for (const rid of rangeIds) next[rid] = true;
                    table.setRowSelection(next);
                    return;
                  }
                  // stale anchor (off-page/re-sorted): fall through to single-select
                }

                lastSelectedIdRef.current = currentRowId;

                if (ctrlOrCmdHeld) {
                  row.toggleSelected();
                } else {
                  table.setRowSelection({ [currentRowId]: true });
                }

                const idVal =
                  row.original[idField] ?? row.original["genome_id"] ?? null;
                if (
                  idVal != null &&
                  (typeof idVal === "string" || typeof idVal === "number")
                ) {
                  onGenomeSelect?.(String(idVal));
                  onActiveRowChange?.(String(idVal));
                }
              }}
              style={
                {
                  "--row-start": `${String(virtualRow.start)}px`,
                } as CSSProperties
              }
              variant="tint"
              data-state={row.getIsSelected() ? "selected" : undefined}
              className="group absolute inset-x-0 flex h-6 translate-y-(--row-start) cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  onClick={
                    cell.column.id === "__select__"
                      ? (event) => {
                          event.stopPropagation();
                          if (
                            !(event.target as HTMLElement).closest(
                              'input[type="checkbox"]',
                            )
                          ) {
                            toggleRowSelection(row, table);
                          }
                        }
                      : undefined
                  }
                  // The sticky select cell needs an opaque background (scrolled
                  // cells would show through a transparent one), keyed on the
                  // row's data-state; see TableCell `sticky-select`.
                  variant={
                    cell.column.id === "__select__" ? "sticky-select" : "grid"
                  }
                  className={clsx(
                    // No ellipsis: text-overflow has no effect on a flex
                    // container, so overflow-hidden is all `truncate` did here
                    // (the cell is already whitespace-nowrap).
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
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          );
        })
      )}
    </TableBody>
  );
}

// Given the visible row list and an anchor/target id pair, return the ids of the
// contiguous range between them (inclusive). Empty when either id isn't present.
// Shared by the checkbox and row-body shift-click handlers, which intentionally
// differ in how they *apply* this range (checkbox merges into the existing
// selection; row body replaces it) but compute it identically.
// SSR-safe header-width estimate (pure string math — no canvas/document), so the
// server and the client's first render agree and columns paint at header width
// immediately instead of the 250px columnDef default. Approximates the header branch
// of computeAutoColumnSizes: headers wrap, so only the longest single word sets the
// minimum width. ~7px/char at bold 12px system-ui + 32px th padding, clamped to
// [60, 250]. This is an approximation, not a pixel mirror of the canvas measurement;
// exact fit is applied once by computeAutoColumnSizes when data arrives.
// Array-valued fields (e.g. treatment_duration: [3,6,12,18]) must not render as
// raw React children — React joins array children with no separator, reading as
// "361218" instead of "3, 6, 12, 18".
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

  // Layout overhead beyond raw glyph width:
  //   Header: th px-2(16) + pr-2(8) + gap when sorted(~8) = 32px
  //   Cell:   td px-0.5(4)
  const headerOverhead = 32;
  const cellOverhead = 4;

  for (const col of columns) {
    ctx.font = headerFont;
    // Headers wrap, so only the longest single word dictates the minimum column width.
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
