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

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { getIdField } from "@/constants/resources";
import {
  computeShiftRangeIds,
  estimateHeaderWidth,
  formatCellValue,
} from "./data-table-utils";

import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
        <div className="absolute -bottom-5 left-1/2 z-50 -translate-x-1/2 transform text-[10px] whitespace-nowrap text-blue-600">
          All {meta.totalItems} selected
        </div>
      )}
    </div>
  );
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
        const displayValue = rawValue ?? column.fallbackValue?.(info.row.original);
        const value = formatCellValue(displayValue);
        const href = column.href?.(info.row.original);
        const valueHref = column.valueHref;
        if (valueHref && Array.isArray(rawValue)) {
          return (
            <span className="flex min-w-0 scrollbar-none gap-x-2 overflow-x-auto whitespace-nowrap">
              {[...new Set(rawValue.map(String))].map((itemValue) => {
                return (
                  <Link
                    key={itemValue}
                    href={valueHref.replace(
                      "{value}",
                      encodeURIComponent(itemValue),
                    )}
                    className="shrink-0 text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {itemValue}
                  </Link>
                );
              })}
            </span>
          );
        }
        const scalarValueHref =
          valueHref &&
          (typeof displayValue === "string" ||
            typeof displayValue === "number" ||
            typeof displayValue === "bigint" ||
            typeof displayValue === "boolean")
            ? valueHref.replace(
                "{value}",
                encodeURIComponent(String(displayValue)),
              )
            : undefined;
        const cellHref = scalarValueHref ?? href;
        return cellHref ? (
          <Link
            href={cellHref}
            className="truncate text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {value as React.ReactNode}
          </Link>
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
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Track which download button is currently downloading
  const [downloadingButton, setDownloadingButton] = useState<string | null>(
    null,
  );

  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const rowSelection =
    controlledRowSelection !== undefined
      ? controlledRowSelection
      : internalRowSelection;

  // Store the original order of selected items to maintain consistency
  const [selectedItemsOrder, setSelectedItemsOrder] = useState<
    Map<string, number>
  >(new Map());

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

  const [onlyVisibleColumns, setOnlyVisibleColumns] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const justResizedRef = useRef(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setShowColumnMenu(false);
      }
    };

    if (showColumnMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showColumnMenu]);

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

      // Update the order map for selected items
      const newOrderMap = new Map(selectedItemsOrder);
      Object.keys(newSelection).forEach((rowId) => {
        if (!selectedItemsOrder.has(rowId)) {
          newOrderMap.set(rowId, newOrderMap.size);
        }
      });
      // Prune IDs absent from newSelection (handles replace-style setRowSelection
      // where old ids are simply omitted rather than set to false)
      for (const rowId of [...newOrderMap.keys()]) {
        if (!(rowId in newSelection)) {
          newOrderMap.delete(rowId);
        }
      }
      setSelectedItemsOrder(newOrderMap);

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

  // Handle column drag start
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle column drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Handle column drop
  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();

    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      return;
    }

    const allColumns = table.getAllLeafColumns();
    const columnIds = allColumns.map((col) => col.id);

    const draggedIndex = columnIds.indexOf(draggedColumn);
    const targetIndex = columnIds.indexOf(targetColumnId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null);
      return;
    }

    // Create new column order
    const newOrder = [...columnIds];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    // Update column order
    onColumnOrderChange?.(newOrder);
    setDraggedColumn(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  const handleDownload = async (
    format: "csv" | "txt",
    onlySelected = false,
  ) => {
    // Set downloading state
    const buttonKey = `${format}-${onlySelected ? "selected" : "all"}`;
    setDownloadingButton(buttonKey);

    try {
      // If downloading selected and all pages are selected, download all data
      if (onlySelected && isAllPagesSelected && onDownloadAll) {
        const allCols = table.getAllLeafColumns();
        const visibleCols = onlyVisibleColumns
          ? allCols.filter(
              (col) => col.getIsVisible() && col.id !== "__select__",
            )
          : allCols.filter((col) => col.id !== "__select__");

        const visibleColumnIds = visibleCols.map((col) => col.id);
        await onDownloadAll(
          format,
          onlyVisibleColumns ? visibleColumnIds : null,
        );
        return;
      }

      // If downloading all data and onDownloadAll is provided, use it
      if (!onlySelected && onDownloadAll) {
        const allCols = table.getAllLeafColumns();
        const visibleCols = onlyVisibleColumns
          ? allCols.filter(
              (col) => col.getIsVisible() && col.id !== "__select__",
            )
          : allCols.filter((col) => col.id !== "__select__");

        const visibleColumnIds = visibleCols.map((col) => col.id);
        await onDownloadAll(
          format,
          onlyVisibleColumns ? visibleColumnIds : null,
        );
        return;
      }

      // Otherwise, use the local download logic (for selected rows or when onDownloadAll is not provided)
      const allCols = table.getAllLeafColumns();
      const visibleCols = onlyVisibleColumns
        ? allCols.filter((col) => col.getIsVisible() && col.id !== "__select__")
        : allCols.filter((col) => col.id !== "__select__");

      const headers = visibleCols.map((col) => col.columnDef.header as string);

      if (onlySelected) {
        if (!isAllPagesSelected && (!selectedIds || selectedIds.length === 0))
          return;

        const selectedColumnIds = visibleCols.map((col) => col.id);
        if (onDownloadSelected) {
          await onDownloadSelected(
            format,
            selectedIds ?? [],
            onlyVisibleColumns ? selectedColumnIds : null,
          );
          return;
        }

        const idFilter = (selectedIds ?? [])
          .map((id) => `eq(${idField},${id})`)
          .join(",");

        const query = `or(${idFilter})`;

        const DataAPI = process.env.NEXT_PUBLIC_DATA_API;

        await fetch(`${DataAPI ?? ""}/${resource}/`, {
          method: "POST",
          headers: {
            "Content-type": "application/rqlquery+x-www-form-urlencoded",
            Accept: "application/json",
            Range: `items=0-${String((selectedIds ?? []).length)}`,
            "X-Range": `items=0-${String((selectedIds ?? []).length)}`,
          },
          body: query,
        })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch selected rows");
            return res.json();
          })
          .then((data: unknown) => {
            type RowBag = Record<string, unknown>;
            interface ResponseShape {
              items?: RowBag[];
              response?: RowBag[];
              rows?: RowBag[];
            }
            const rowsArray: RowBag[] = Array.isArray(data)
              ? (data as RowBag[])
              : ((data as ResponseShape).items ??
                (data as ResponseShape).response ??
                (data as ResponseShape).rows ??
                []);

            // Sort the rows based on the original selection order
            const sortedRows = rowsArray.sort((a, b) => {
              const aId = String(a[idField]);
              const bId = String(b[idField]);
              const aOrder = selectedItemsOrder.get(aId) ?? Number.MAX_VALUE;
              const bOrder = selectedItemsOrder.get(bId) ?? Number.MAX_VALUE;
              return aOrder - bOrder;
            });

            const content = [
              headers.join(","),
              ...sortedRows.map((row) =>
                visibleCols
                  .map((col) => {
                    return csvExportValue(row[col.id]);
                  })
                  .join(","),
              ),
            ].join("\n");

            downloadFile(`${resource}-selected.${format}`, content);
          })
          .catch((err: unknown) => {
            console.error("Download selected failed:", err);
          });

        return;
      }

      const rowsToExport = table.getPrePaginatedRowModel().rows;

      const content = [
        headers.join(","),
        ...rowsToExport.map((row) =>
          visibleCols
            .map((col) => {
              return csvExportValue(row.getValue<unknown>(col.id));
            })
            .join(","),
        ),
      ].join("\n");

      downloadFile(`${resource}.${format}`, content);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloadingButton(null);
    }
  };

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
      <div className="mb-2 flex w-full justify-end px-5" ref={controlsRef}>
        <div className="relative inline-block text-left" ref={columnMenuRef}>
          {" "}
          {/* This is the button for changing the visibility of columns in the table */}
          <Button
            className="mr-2 flex w-full justify-end rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
            onClick={() => {
              setShowColumnMenu((prev) => !prev);
            }}
          >
            Columns ▾
          </Button>
          {showColumnMenu && (
            <div className="ring-opacity-5 absolute left-0 z-50 mt-1 w-40 rounded-md bg-background shadow-lg ring-1 ring-border">
              <div className="max-h-64 overflow-auto py-1 text-xs">
                {table.getAllColumns().map((column) =>
                  column.id === "__select__" ? null : (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center space-x-2 px-2 py-1 text-foreground hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={() => {
                          column.toggleVisibility();
                        }}
                      />
                      <span>{column.columnDef.header as string}</span>
                    </label>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {/* Download buttons */}
        {showExportControls && (
          <>
            <Button
              onClick={() => {
                void handleDownload("csv");
              }}
              className="mx-2 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
              disabled={downloadingButton !== null}
            >
              {downloadingButton === "csv-all" ? (
                <span className="text-red-600">Downloading...</span>
              ) : (
                "Download (CSV)"
              )}
            </Button>
            <Button
              onClick={() => {
                void handleDownload("txt");
              }}
              className="mr-2 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
              disabled={downloadingButton !== null}
            >
              {downloadingButton === "txt-all" ? (
                <span className="text-red-600">Downloading...</span>
              ) : (
                "Download (TXT)"
              )}
            </Button>

            {/* These next two only show up if rows are selected */}
            {((selectedIds?.length ?? 0) > 0 || isAllPagesSelected) && (
              <>
                <Button
                  onClick={() => {
                    void handleDownload("csv", true);
                  }}
                  className="mr-2 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={downloadingButton !== null}
                >
                  {downloadingButton === "csv-selected" ? (
                    <span className="text-red-600">Downloading...</span>
                  ) : (
                    "Download Selected (CSV)"
                  )}
                </Button>
                <Button
                  onClick={() => {
                    void handleDownload("txt", true);
                  }}
                  className="mr-2 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                  disabled={downloadingButton !== null}
                >
                  {downloadingButton === "txt-selected" ? (
                    <span className="text-red-600">Downloading...</span>
                  ) : (
                    "Download Selected (TXT)"
                  )}
                </Button>
              </>
            )}

            <label className="ml-4 flex items-center text-xs text-foreground">
              <input
                type="checkbox"
                checked={onlyVisibleColumns}
                onChange={() => {
                  setOnlyVisibleColumns((prev) => !prev);
                }}
                className="mr-1"
              />
              Download Displayed Columns Only
            </label>
          </>
        )}
      </div>
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
              <TableHeader
                ref={headerRef}
                className="border-border bg-muted text-foreground"
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 30,
                }}
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="flex border-y border-border bg-muted"
                  >
                    {headerGroup.headers.map((header) => {
                      const column = header.column;
                      const minSize = column.columnDef.minSize ?? 40;
                      const maxSize = column.columnDef.maxSize ?? 1000;
                      const resizeWithKeyboard = (delta: number) => {
                        const size = Math.min(
                          maxSize,
                          Math.max(minSize, column.getSize() + delta),
                        );
                        table.setColumnSizing((current) => ({
                          ...current,
                          [column.id]: size,
                        }));
                      };
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          aria-sort={
                            column.id === "__select__" || !column.getCanSort()
                              ? undefined
                              : column.getIsSorted() === "asc"
                                ? "ascending"
                                : column.getIsSorted() === "desc"
                                  ? "descending"
                                  : "none"
                          }
                          className={clsx(
                            "group relative border-r border-foreground/20 bg-muted text-foreground",
                            column.id === "__select__"
                              ? "flex h-auto! items-center justify-center p-0"
                              : "h-auto! min-h-7! cursor-pointer px-2 py-0 align-middle text-xs leading-tight font-bold whitespace-normal",
                          )}
                          style={{
                            width: `var(--col-${column.id}-size)`,
                            minWidth: `var(--col-${column.id}-size)`,
                            maxWidth: `var(--col-${column.id}-size)`,
                            ...(column.id === "__select__" && {
                              position: "sticky",
                              left: 0,
                              zIndex: 1,
                            }),
                          }}
                        >
                          {column.id === "__select__" ? (
                            // Checkbox column - no sorting or dragging
                            <div className="flex size-full items-center justify-center py-0">
                              <table.FlexRender header={header} />
                            </div>
                          ) : (
                            // Regular column - sortable and draggable
                            <>
                              <div
                                className="relative flex size-full items-center py-0 pr-0.5"
                                draggable={true}
                                onDragStart={(e) => {
                                  handleDragStart(e, column.id);
                                }}
                                onDragOver={handleDragOver}
                                onDrop={(e) => {
                                  handleDrop(e, column.id);
                                }}
                                onDragEnd={handleDragEnd}
                                style={{
                                  cursor: "move",
                                  opacity:
                                    draggedColumn === column.id ? 0.5 : 1,
                                  backgroundColor:
                                    draggedColumn && draggedColumn !== column.id
                                      ? "transparent"
                                      : "",
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={!column.getCanSort()}
                                  aria-label={`Sort by ${String(column.columnDef.header)}`}
                                  className="flex size-full items-center text-left leading-tight select-none focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-default"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (justResizedRef.current) return;
                                    column.getToggleSortingHandler()?.(event);
                                  }}
                                >
                                  <table.FlexRender header={header} />
                                  {column.getIsSorted() === "asc" && (
                                    <ChevronUp className="ml-0.5 inline-block size-3 align-text-bottom" />
                                  )}
                                  {column.getIsSorted() === "desc" && (
                                    <ChevronDown className="ml-0.5 inline-block size-3 align-text-bottom" />
                                  )}
                                </button>
                              </div>
                              {column.getCanResize() && (
                                <div
                                  role="separator"
                                  aria-orientation="vertical"
                                  aria-label={`Resize ${column.id} column`}
                                  aria-valuemin={minSize}
                                  aria-valuemax={maxSize}
                                  aria-valuenow={column.getSize()}
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
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    justResizedRef.current = false;
                                    header.getResizeHandler()(e);
                                    const onUp = () => {
                                      justResizedRef.current = true;
                                      setTimeout(() => {
                                        justResizedRef.current = false;
                                      }, 100);
                                      window.removeEventListener(
                                        "mouseup",
                                        onUp,
                                      );
                                    };
                                    window.addEventListener("mouseup", onUp);
                                  }}
                                  className="absolute top-0 right-0 z-30 flex h-full w-2 cursor-col-resize touch-none select-none"
                                  style={{ transform: "translateX(50%)" }}
                                >
                                  <div
                                    className={clsx(
                                      "mx-auto h-full w-1 transition-opacity",
                                      header.column.getIsResizing()
                                        ? "bg-blue-500 opacity-100"
                                        : "bg-muted-foreground opacity-0 group-hover:opacity-100",
                                    )}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>

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

        <div
          className="z-10 w-full border-t border-border bg-muted py-1 shadow-sm"
          ref={footerRef}
        >
          <div className="flex flex-wrap items-center justify-between gap-y-1 px-2">
            <div className="shrink-0 text-xs">
              {(() => {
                const { pageIndex, pageSize } = table.state.pagination;
                const totalRows = totalItems;
                const hasResults = totalItems > 0;
                const start = hasResults ? pageIndex * pageSize + 1 : 0;
                const end = hasResults
                  ? isLoading
                    ? Math.min(start + pageSize - 1, totalRows)
                    : data.length > 0
                      ? Math.min(start + data.length - 1, totalRows)
                      : 0
                  : 0;

                const selectedCount = isAllPagesSelected
                  ? totalItems
                  : (totalSelectedCount ?? Object.keys(rowSelection).length);

                return (
                  <div className="flex flex-col">
                    <span>
                      Showing {start}-{end} of {totalRows} results
                    </span>
                    {selectedCount > 0 && (
                      <span className="font-semibold text-blue-600">
                        {isAllPagesSelected
                          ? `All ${String(totalItems)} results selected`
                          : `${String(selectedCount)} selected`}
                      </span>
                    )}
                  </div>
                );
              })()}
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
                aria-label="Previous page"
                className="border border-border px-2 py-0.5 disabled:opacity-50"
              >
                {"Prev"}
              </Button>
              {(() => {
                const pageCount = table.getPageCount();
                const currentPage = table.state.pagination.pageIndex;
                const pages: number[] = [];

                if (pageCount > 0) pages.push(0);
                for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                  if (i > 0 && i < pageCount - 1) pages.push(i);
                }
                if (pageCount > 1) pages.push(pageCount - 1);
                const uniquePages = [...new Set(pages)].sort((a, b) => a - b);

                return uniquePages.map((page, idx) => {
                  const prev = idx > 0 ? uniquePages[idx - 1] : undefined;
                  const showDots = prev !== undefined && page - prev > 1;
                  return (
                    <span key={page} className="flex items-center gap-x-1">
                      {showDots && (
                        <span className="text-muted-foreground">...</span>
                      )}
                      <Button
                        onClick={() => {
                          table.setPageIndex(page);
                        }}
                        className={clsx(
                          "border bg-background px-2 py-0.5 text-foreground",
                          currentPage === page
                            ? "bg-primary/15 font-bold"
                            : "bg-background",
                        )}
                        aria-current={currentPage === page ? "page" : undefined}
                      >
                        {page + 1}
                      </Button>
                    </span>
                  );
                });
              })()}
              <Button
                onClick={() => {
                  table.nextPage();
                }}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
                className="border border-border px-2 py-0.5 disabled:opacity-50"
              >
                {"Next"}
              </Button>
            </nav>
          </div>
        </div>
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

function csvExportValue(value: unknown): string {
  if (value == null) return "";
  const quoted = typeof value === "string" || typeof value === "object";
  let serialized: string;
  if (typeof value === "string") serialized = value;
  else if (typeof value === "object") serialized = JSON.stringify(value);
  else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    serialized = String(value);
  else return "";

  const cleaned = serialized.replace(/\r\n|\n|\r/g, " ");
  const safe = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return quoted ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
