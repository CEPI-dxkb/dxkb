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
import { useRef, useState, useEffect } from "react";
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

import { Table, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableControls } from "./data-table-controls";
import { DataTableFooter } from "./data-table-footer";
import { DataTableHeader } from "./data-table-header";
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
        <div className="absolute -bottom-5 left-1/2 z-50 -translate-x-1/2 transform text-3xs whitespace-nowrap text-blue-600">
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
                    className="shrink-0 text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
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
            className="truncate text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
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

  // row selection (controlled)
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;

  // Cross-page selection
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
  scrollRegionLabel?: string;
  // Loading indicator: parent can set this while data is being fetched
  isLoading?: boolean;

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
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    isAllPagesSelected = false,
    onAllPagesSelectionChange,
    totalSelectedCount,
    onDownloadAll,
    onDownloadSelected,
    showExportControls = true,
    scrollRegionLabel,
    isLoading = false,
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
  // Live clientWidth of the scroll container. Drives full-width column stretch;
  // updated by a ResizeObserver so the table reflows when the side panel or
  // vertical menu changes the available width.
  const [containerWidth, setContainerWidth] = useState(0);
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

  const activeColumnSizing = sizingByKey[sizingKey] ?? emptyColumnSizing;
  const measuredSizingKeysRef = useRef(new Set<string>());
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
      next[col.id] = Math.max(
        estimateHeaderWidth(col.label),
        autoSizes[col.id] ?? 0,
      );
    }
    setSizingByKey((current) => ({ ...current, [sizingKey]: next }));
  }, [columns, data, sizingKey, setSizingByKey]);

  // Track the scroll container's width so columns can stretch to fill it.
  // Fires on side-panel resize, vertical-menu collapse, and window resize.
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      // Floor so the stretched total never exceeds the container by a sub-pixel,
      // which would spawn a spurious 1px horizontal scrollbar.
      setContainerWidth(Math.floor(entries[0].contentRect.width));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

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
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    onColumnSizingChange: (updater) => {
      setSizingByKey((prev) => {
        const base = prev[sizingKey] ?? emptyColumnSizing;
        const next = typeof updater === "function" ? updater(base) : updater;
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

  // Memoized CSS vars so cells update via CSS during drag without React re-rendering each cell.
  // Columns stretch to fill the container: any width the natural sizes leave unused
  // is distributed proportionally across the resizable columns. When natural sizes
  // already exceed the container (e.g. a column dragged very wide) the surplus is
  // negative, so widths fall back to natural and the container scrolls horizontally.
  // The actively-resizing column is excluded from stretch so its drag tracks the
  // cursor 1:1 and can push the total past the container edge.
  const resizingColumnId = table.state.columnResizing.isResizingColumn;
  const columnSizeVars = (() => {
    const leafColumns = table.getVisibleLeafColumns();
    const naturalSizes = leafColumns.map((c) => c.getSize());
    const naturalTotal = naturalSizes.reduce((a, b) => a + b, 0);

    const finalSizes = new Map<string, number>();
    leafColumns.forEach((c, i) => {
      finalSizes.set(c.id, naturalSizes[i]);
    });

    // The resize handle (w-2, translateX(50%)) overhangs each cell's right edge
    // by 4px. Interior overhangs overlap harmlessly, but the last column's would
    // push a 4px phantom horizontal scrollbar once the table fills exactly — so
    // stop the stretch 4px short and let that final handle occupy the gap.
    const handleOverhang = 4;
    const surplus = containerWidth - handleOverhang - naturalTotal;
    if (surplus > 0) {
      const eligible = leafColumns.filter(
        (c) => c.getCanResize() && c.id !== resizingColumnId,
      );
      const eligibleTotal = eligible.reduce((a, c) => a + c.getSize(), 0);
      if (eligibleTotal > 0) {
        let distributed = 0;
        eligible.forEach((c, i) => {
          const add =
            i === eligible.length - 1
              ? surplus - distributed // last column absorbs rounding remainder
              : Math.round(surplus * (c.getSize() / eligibleTotal));
          distributed += add;
          finalSizes.set(c.id, c.getSize() + add);
        });
      }
    }

    const vars: Record<string, string> = {};
    for (const header of table.getFlatHeaders()) {
      vars[`--col-${header.column.id}-size`] =
        `${String(finalSizes.get(header.column.id) ?? header.column.getSize())}px`;
    }
    return vars;
  })();

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
      {!isAllPagesSelected && table.getIsAllPageRowsSelected() && (
        <div className="mb-2 flex w-full items-center justify-between border border-blue-200 bg-blue-50 px-4 py-2">
          <span className="text-blue-700">
            All {data.length} results on this page are selected.
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAllPagesSelectionChange?.(true);
            }}
            className="cursor-pointer font-semibold text-blue-700 underline hover:text-blue-900"
          >
            Select all {totalItems} results across all pages
          </button>
        </div>
      )}
      {isAllPagesSelected && (
        <div className="mb-2 w-full border border-blue-300 bg-blue-100 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-800">
              All {totalItems} results are selected across all pages.
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onAllPagesSelectionChange?.(false);
                table.toggleAllRowsSelected(false);
                if (onRowSelectionChange) {
                  onRowSelectionChange({});
                }
              }}
              className="cursor-pointer text-blue-700 underline hover:text-blue-900"
            >
              Clear selection
            </button>
          </div>
          <div className="mt-1 text-xs text-blue-700">
            Note: Checkboxes on other pages may not appear checked for
            performance reasons, but all rows are selected.
          </div>
        </div>
      )}
      <DataTableControls
        table={table}
        resource={resource}
        selectedIds={selectedIds}
        isAllPagesSelected={isAllPagesSelected}
        onDownloadAll={onDownloadAll}
        onDownloadSelected={onDownloadSelected}
        showExportControls={showExportControls}
      />
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded border border-border">
        <div
          className={clsx(
            "relative flex-1",
            // During load, clip the overestimated skeleton rows (no scrollbar);
            // switch to auto once real rows/virtualizer drive the height.
            isLoading ? "overflow-hidden" : "overflow-auto",
            (shiftHeld || ctrlOrCmdHeld) && "select-none",
          )}
          ref={tableContainerRef}
          role="region"
          aria-label={scrollRegionLabel ?? `${resource} results`}
          tabIndex={0}
          style={{
            maxHeight: "100%",
            position: "relative",
          }}
        >
          <div className="relative min-w-max" style={columnSizeVars}>
            <Table
              className="relative w-full table-auto border-collapse text-xs"
              style={{ borderSpacing: 0 }}
              disableScrollWrapper={true}
            >
              <DataTableHeader
                table={table}
                onColumnOrderChange={onColumnOrderChange}
              />

              <DataTableBody
                table={table}
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
                isLoading={isLoading}
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
  isLoading?: boolean;
  skeletonRowCount?: number;
}

function DataTableBody({
  table,
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
  isLoading = false,
  skeletonRowCount = 20,
}: DataTableBodyProps) {
  "use no memo";
  return (
    <TableBody
      style={{
        position: "relative",
        // While loading, fill the container (height:100%) so the absolute skeleton
        // rows have a full-height positioning context. The scroll container is set
        // to overflow:hidden during load (see DataTable), so the intentionally
        // overestimated rows are clipped to reach the footer with no gap/scrollbar.
        height: isLoading ? "100%" : totalSize,
      }}
      className="relative z-10 border-collapse gap-0"
    >
      {isLoading ? (
        Array.from({ length: skeletonRowCount }, (_, rowIdx) => (
          <TableRow
            key={rowIdx}
            className="absolute flex w-full border-b border-border"
            style={{ top: rowIdx * 24, height: 24 }}
          >
            {table.getVisibleLeafColumns().map((col, colIdx) => (
              <TableCell
                key={col.id}
                className={clsx(
                  "flex items-center border border-border",
                  col.id === "__select__" ? "p-0" : "p-0.5",
                )}
                style={{
                  width: `var(--col-${col.id}-size)`,
                  minWidth: `var(--col-${col.id}-size)`,
                  maxWidth: `var(--col-${col.id}-size)`,
                  height: 24,
                }}
              >
                {col.id === "__select__" ? (
                  <Skeleton className="size-3.5 rounded-sm" />
                ) : (
                  <Skeleton
                    className="h-3 rounded"
                    style={{
                      width: `${String(skeletonWidthPcts[(rowIdx * 7 + colIdx) % skeletonWidthPcts.length])}%`,
                    }}
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
            className="w-full p-0.5 text-left text-muted-foreground"
            style={{ justifyContent: "left" }}
          >
            {errorMessage ? (
              <span className="text-destructive">{errorMessage}</span>
            ) : (
              "No results"
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
              style={{
                transform: `translateY(${String(virtualRow.start)}px)`,
                height: "24px",
              }}
              className={clsx(
                "group absolute inset-x-0 flex cursor-pointer",
                row.getIsSelected()
                  ? "bg-primary/15 dark:bg-primary/30"
                  : "hover:bg-muted",
              )}
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
                  className={clsx(
                    "flex items-center truncate border border-border",
                    cell.column.id === "__select__"
                      ? clsx(
                          "justify-center p-0",
                          row.getIsSelected()
                            ? ""
                            : "bg-background group-hover:bg-muted",
                        )
                      : "justify-start p-0.5",
                  )}
                  style={{
                    width: `var(--col-${cell.column.id}-size)`,
                    minWidth: `var(--col-${cell.column.id}-size)`,
                    maxWidth: `var(--col-${cell.column.id}-size)`,
                    height: "24px",
                    ...(cell.column.id === "__select__" && {
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      // color-mix produces an opaque equivalent of bg-primary/15 over
                      // the page background — transparent backgrounds on sticky elements
                      // let scrolled content bleed through.
                      ...(row.getIsSelected() && {
                        backgroundColor:
                          "color-mix(in srgb, var(--color-primary) 15%, var(--color-background))",
                      }),
                    }),
                  }}
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
