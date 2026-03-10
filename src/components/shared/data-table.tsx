"use client";

import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
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
} from "@dnd-kit/sortable";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DraggableTableHeader, TableSkeleton, type TableSkeletonColumn } from "./data-table-header";

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

// Use a generic forwardRef wrapper
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
