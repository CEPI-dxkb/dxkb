'use client';

import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  flexRender,
  SortingState,
  PaginationState,
  ColumnOrderState,
  ColumnSizingState,
  VisibilityState,
  RowSelectionState,
  ColumnPinningState,
} from '@tanstack/react-table';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';
import clsx from 'clsx';

interface ColumnInfo {
  id: string;
  label: string;
  visible?: boolean;
}

interface DataTableProps {
  id: string;
  data: Record<string, any>[];
  columns: ColumnInfo[];
  onSelectionChange?: (rows: any[]) => void;
  onGenomeSelect?: (id: string | null) => void;
  pageIndex: number; // controlled page index
  pageSize: number; // controlled page size
  totalItems: number; // total items in DB 
  onPageChange: (page: number) => void; // callback when page changes
  sorting?: SortingState; // controlled sorting (optional)
  onSortingChange?: (s: SortingState) => void; // optional sorting callback
  onDownloadAll?: (format: 'csv' | 'txt', visibleColumns: string[]) => void;
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
}

export function DataTable({
  id,
  data,
  columns,
  onSelectionChange,
  onGenomeSelect,
  pageIndex,
  pageSize,
  totalItems,
  onPageChange,
  sorting,
  onSortingChange,
  onDownloadAll
}: DataTableProps) {
  // helpers for localStorage persistence (per table id)
  const getStored = <T,>(key: string, fallback: T): T => {
    try {
      if (typeof window === 'undefined') return fallback;
      const raw = localStorage.getItem(`${id}-${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const setStored = (key: string, value: any) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(`${id}-${key}`, JSON.stringify(value));
    } catch {}
  };

  // persisted states
  const [internalSorting, setInternalSorting] = useState<SortingState>(() =>
    getStored<SortingState>('sorting', [])
  );
  const [internalPagination, setInternalPagination] = useState<PaginationState>(() =>
    getStored<PaginationState>('pagination', { pageIndex: 0, pageSize: pageSize ?? 200 })
  );

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    getStored<ColumnOrderState>(
      'columnOrder',
      ['__select__', ...columns.map((c) => c.id)]
    )
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    getStored<VisibilityState>(
      'columnVisibility',
      Object.fromEntries(columns.map((c) => [c.id, c.visible !== false]))
    )
  );

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    getStored<ColumnSizingState>('columnSizing', {})
  );

  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() =>
    getStored<ColumnPinningState>('columnPinning', { left: ['__select__'] })
  );

  // other UI states
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [onlyVisibleColumns, setOnlyVisibleColumns] = useState(false);

  // selection & last shift index
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const lastSelectedIndexRef = useRef<number | null>(null);

  // sizing / refs for DOM interactions
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const resizeLineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  // Prevent sorting right after resizing
  const isResizingRef = useRef(false);


  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    if (showColumnMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  // measure/layout niceties (kept from original)
  useEffect(() => {
    const measure = () => {
      const controlsHeight = controlsRef.current?.offsetHeight || 0;
      const footerHeight = footerRef.current?.offsetHeight || 0;
      const viewportHeight = window.innerHeight;
      // placeholder - kept for layout recalculation hook
    };
    const handle = requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(measure));
    if (controlsRef.current) resizeObserver.observe(controlsRef.current);
    if (footerRef.current) resizeObserver.observe(footerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(handle);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Column defs (checkbox + mapped columns)
  const columnDefs = useMemo<ColumnDef<any, any>[]>(() => {
    const checkboxColumn: ColumnDef<any> = {
      id: '__select__',
      header: ({ table }) => (
        <div className="flex justify-center items-center w-full h-full">
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={(e) => {
              e.stopPropagation();
              table.toggleAllRowsSelected();
            }}
            className="cursor-pointer m-0 p-0"
          />
        </div>
      ),
      cell: ({ row }) => {
        // NOTE: row ids are per-page index (string of index)
        return (
          <div className="flex justify-center items-center w-full h-full">
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={() => {}}
              onClick={(e) => {
                e.stopPropagation();
                const isShift = (e as React.MouseEvent<HTMLInputElement>).shiftKey;
                const allRows = table.getPaginationRowModel().rows;
                const currentRowId = row.id;
                const currentIndex = allRows.findIndex((r) => r.id === currentRowId);
                if (currentIndex === -1) return;

                const lastSelectedIndex = lastSelectedIndexRef.current;

                if (isShift && lastSelectedIndex !== null && lastSelectedIndex !== currentIndex) {
                  const start = Math.min(lastSelectedIndex, currentIndex);
                  const end = Math.max(lastSelectedIndex, currentIndex);
                  const newSelection: Record<string, boolean> = {};
                  for (let i = start; i <= end; i++) {
                    const rId = allRows[i]?.id;
                    if (rId) newSelection[rId] = true;
                  }
                  table.setRowSelection((prev) => ({ ...prev, ...newSelection }));
                } else {
                  const isSelected = row.getIsSelected();
                  table.setRowSelection((prev) => ({ ...prev, [row.id]: !isSelected }));
                }

                lastSelectedIndexRef.current = currentIndex;

                // cascade genome selection id (send first selected row's genome_id)
                if (row.getIsSelected()) {
                  onGenomeSelect?.(null);
                } else {
                  const genomeId = row.original?.genome_id;
                  if (genomeId) onGenomeSelect?.(genomeId);
                }
              }}
              className="cursor-pointer m-0 p-0"
            />
          </div>
        );
      },
      enableResizing: false,
      size: 40,
      minSize: 40,
      maxSize: 40,
    };

    const mapped = columns.map((col) => ({
      accessorKey: col.id,
      header: col.label,
      cell: (info: any) => {
        const value = info.getValue();
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          const date = new Date(value);
          return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        }
        return value;
      },
      size: 200,
      enableResizing: true,
      enableSorting: true,
      sortingFn: (rowA: any, rowB: any, columnId: string) => {
        const a = rowA.getValue(columnId);
        const b = rowB.getValue(columnId);
        const aIsEmpty = a === undefined || a === null || a === '';
        const bIsEmpty = b === undefined || b === null || b === '';
        if (aIsEmpty && bIsEmpty) return 0;
        if (aIsEmpty) return 1;
        if (bIsEmpty) return -1;
        return a > b ? 1 : a < b ? -1 : 0;
      },
    })) as ColumnDef<any, any>[];

    return [checkboxColumn, ...mapped];
    // columns is stable from props
  }, [columns, onGenomeSelect]);

  // default pinning (ensure select checkbox pinned left)
  useEffect(() => {
    // ensure __select__ is pinned left when nothing stored
    if (!columnPinning?.left?.includes('__select__')) {
      setColumnPinning((prev) => {
        const left = prev?.left ? Array.from(new Set(['__select__', ...prev.left])) : ['__select__'];
        const updated = { ...prev, left };
        setStored('columnPinning', updated);
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled vs internal values
  const currentSorting = sorting ?? internalSorting;
  const currentPageIndex = pageIndex ?? internalPagination.pageIndex;
  const currentPageSize = pageSize ?? internalPagination.pageSize;

  // Build react-table
  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      sorting: currentSorting,
      pagination: {
        pageIndex: currentPageIndex,
        pageSize: currentPageSize,
      },
      columnOrder,
      columnVisibility,
      columnSizing,
      rowSelection,
      columnPinning,
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(currentSorting) : updater;
      if (onSortingChange) {
        onSortingChange(newSorting);
      } else {
        setInternalSorting(newSorting);
        setStored('sorting', newSorting);
      }
      // reset to first page when sorting
      if (onPageChange) {
        onPageChange(0);
      } else {
        setInternalPagination((prev) => {
          const next = { ...prev, pageIndex: 0 };
          setStored('pagination', next);
          return next;
        });
      }
    },
    onPaginationChange: (updater) => {
      if (onPageChange) {
        const newPageIndex = typeof updater === 'function' ? updater(currentPageIndex) : (updater as any).pageIndex;
        onPageChange(newPageIndex);
      } else {
        const newPagination = typeof updater === 'function' ? updater(internalPagination) : updater;
        setInternalPagination(newPagination);
        setStored('pagination', newPagination);
      }
    },
    onColumnOrderChange: (u) => {
      setColumnOrder(u);
      setStored('columnOrder', u);
    },
    onColumnVisibilityChange: (u) => {
      setColumnVisibility(u);
      setStored('columnVisibility', u);
    },
    onColumnSizingChange: (u) => {
      setColumnSizing(u);
      setStored('columnSizing', u);
    },
    onRowSelectionChange: (u) => {
      const newSelection = typeof u === 'function' ? u(rowSelection) : u;
      setRowSelection(newSelection);
      // cascade up selected row data
      if (onSelectionChange) {
        const selectedRows = Object.keys(newSelection)
          .filter((k) => newSelection[k])
          .map((k) => data[parseInt(k, 10)])
          .filter(Boolean);
        onSelectionChange(selectedRows);
      }
    },
    onColumnPinningChange: (u) => {
      setColumnPinning(u);
      setStored('columnPinning', u);
    },
    columnResizeMode: 'onEnd',
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    enableSortingRemoval: false,
    enableMultiRowSelection: true,
    enableColumnPinning: true,
    getRowId: (row, index) => String(index),
    manualPagination: true, // server-driven
  });

  // Keep CSS variable widths aligned when column visibility changes
  useEffect(() => {
    const sizing = table.getState().columnSizing;
    Object.entries(sizing).forEach(([id, size]) => {
      document.documentElement.style.setProperty(`--col-${id}-width`, `${size}px`);
    });
  }, [table.getState().columnVisibility]);

  // persist some states when changed
  useEffect(() => setStored('columnOrder', columnOrder), [columnOrder]);
  useEffect(() => setStored('columnVisibility', columnVisibility), [columnVisibility]);
  useEffect(() => setStored('columnSizing', columnSizing), [columnSizing]);
  useEffect(() => setStored('columnPinning', columnPinning), [columnPinning]);

// expose some column sizing vars (for CSS custom props)
// Recompute whenever column sizing *or* visibility changes so visible toggles
// immediately re-apply the same size variables used by header/cells.
const columnSizeVars = useMemo(() => {
  const headers = table.getFlatHeaders();
  const sizingState = table.getState().columnSizing ?? {};
  const vars: Record<string, string> = {};

  for (const header of headers) {
    // Prefer the column's current getSize(), fall back to sizingState, otherwise a default
    const colId = header.column.id;
    const size = header.column.getSize() ?? (sizingState[colId] as number) ?? 200;
    vars[`--col-${colId}-size`] = `${Math.max(40, size)}px`;
  }

  return vars;
}, [
  // trigger recompute when sizing changes OR column visibility changes
  table.getState().columnSizing,
  table.getState().columnSizingInfo,
  table.getState().columnVisibility,
]);

  const rows = table.getPaginationRowModel().rows;

  // virtualization
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // column resize ghost line behavior
  const handleResizeStart = (event: React.MouseEvent, header: any) => {
    event.preventDefault();
    event.stopPropagation(); // 🛑 Prevent click events from triggering sort
    isResizingRef.current = true; // 🪣 Flag that we’re resizing

    const startX = event.clientX;
    const column = header.column;
    const startSize = column.getSize();
    const colElement = event.currentTarget.closest('th') as HTMLElement;
    if (!colElement) return;

    const tableRect = colElement.closest('table')!.getBoundingClientRect();

    if (resizeLineRef.current) {
      resizeLineRef.current.style.left = `${colElement.getBoundingClientRect().right - tableRect.left}px`;
      resizeLineRef.current.style.display = 'block';
    }

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newSize = Math.max(40, startSize + delta);
      if (resizeLineRef.current) {
        resizeLineRef.current.style.left = `${colElement.getBoundingClientRect().left - tableRect.left + newSize}px`;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const finalSize = Math.max(40, startSize + delta);

      setColumnSizing((prev) => {
        const updated = { ...prev, [column.id]: finalSize };
        setStored('columnSizing', updated);
        return updated;
      });

      if (resizeLineRef.current) {
        resizeLineRef.current.style.display = 'none';
      }

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      // 🧹 Clear resize flag after short delay to avoid triggering sort
      setTimeout(() => {
        isResizingRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // download logic (supports onlySelected and onlyVisibleColumns)
  const handleDownload = (format: 'csv' | 'txt', onlySelected = false) => {
    const allCols = table.getAllLeafColumns();
    const visibleCols = onlyVisibleColumns
      ? allCols.filter((c) => c.getIsVisible() && c.id !== '__select__')
      : allCols.filter((c) => c.id !== '__select__');

    const headers = visibleCols.map((c) => c.columnDef.header as string);
    const rowsToExport = onlySelected ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;

    const content = [
      headers.join(','),
      ...rowsToExport.map((row) =>
        visibleCols.map((col) => {
          const val = row.getValue(col.id);
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      ),
    ].join('\n');

    downloadFile(`table-export${onlySelected ? '-selected.' : '.'}${format}`, content);
  };

  // Pagination calculations (server-driven)
  const pageCount = Math.max(1, Math.ceil((totalItems ?? data.length) / currentPageSize));
  const currentPage = currentPageIndex;
  const totalRows = totalItems ?? data.length;
  const start = currentPageIndex * currentPageSize + 1;
  const end = Math.min(start + currentPageSize - 1, totalRows);

  // safe onPageChange wrapper
  const safeGoToPage = (p: number) => {
    if (p < 0) return;
    const lastPage = Math.max(0, pageCount - 1);
    const target = Math.min(p, lastPage);
    if (onPageChange) onPageChange(target);
    else setInternalPagination((prev) => {
      const next = { ...prev, pageIndex: target };
      setStored('pagination', next);
      return next;
    });
  };

  const visibleColumns = table
  .getVisibleLeafColumns()
  .filter(col => col.id !== '__select__')
  .map(col => col.id);
  

  return (
    <div className="flex flex-col h-full w-full text-xs relative items-center border-0">
      {/* Controls */}
      <div className="w-[100%] flex justify-end mb-2 px-5" ref={controlsRef}>
        <div className="relative inline-block text-left" ref={columnMenuRef}>
          <button
            className="flex justify-end w-full rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
            onClick={() => setShowColumnMenu((p) => !p)}
          >
            Columns ▾
          </button>
          {showColumnMenu && (
            <div className="absolute left-0 mt-1 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-30">
              <div className="py-1 max-h-64 overflow-auto text-xs">
                {table.getAllColumns()
                  .filter((col) => col.id !== '__select__')
                  .map((column) => (
                    <label key={column.id} className="flex items-center space-x-2 px-2 py-1 hover:bg-muted-foreground cursor-pointer text-black">
                      <input type="checkbox" checked={column.getIsVisible()} onChange={() => column.toggleVisibility()} />
                      <span>{column.columnDef.header as string}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => onDownloadAll?.('csv', onlyVisibleColumns
        ? table
            .getVisibleLeafColumns()
            .filter(col => col.id !== '__select__')
            .map(col => col.id)
        : null)} className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2 ml-2">
          Download (CSV)
        </button>
        <button onClick={() => onDownloadAll?.('txt', onlyVisibleColumns
        ? table
            .getVisibleLeafColumns()
            .filter(col => col.id !== '__select__')
            .map(col => col.id)
        : null)} className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2">
          Download (TXT)
        </button>

        {table.getSelectedRowModel().rows.length > 0 && (
          <>
            <button onClick={() => handleDownload('csv', true)} className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2">
              Download Selected (CSV)
            </button>
            <button onClick={() => handleDownload('txt', true)} className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2">
              Download Selected (TXT)
            </button>
          </>
        )}

        <label className="flex items-center text-xs text-foreground ml-4">
          <input
            type="checkbox"
            checked={onlyVisibleColumns}
            onChange={() => setOnlyVisibleColumns((p) => !p)}
            className="mr-1"
          />
          Download Displayed Columns Only
        </label>
      </div>

      {/* Table + virtualized body */}
      <div className="w-full flex flex-col border border-gray-500 rounded relative h-full overflow-hidden">
        <div className="flex-1 overflow-auto relative" ref={tableContainerRef} style={{ maxHeight: '100%', paddingBottom: '52px' }}>
          <div className="min-w-max relative" style={columnSizeVars}>
            <Table className="w-full table-auto text-xs border-collapse" style={{ borderSpacing: 0 }}>
              <TableHeader ref={headerRef} className="sticky top-0 bg-primary text-secondary uppercase border-black z-20">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="flex border-t border-b border-black">
                    {headerGroup.headers.map((header) => {
                      const column = header.column;
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={clsx(
                            'border-r border-l border-black bg-primary text-secondary relative',
                            column.id === '__select__' ? 'p-0 flex justify-center items-center' : 'px-2 py-0 text-sm font-bold leading-none align-middle'
                          )}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', column.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedColumnId = e.dataTransfer.getData('text/plain');
                            const targetColumnId = column.id;
                            if (draggedColumnId && draggedColumnId !== targetColumnId && draggedColumnId !== '__select__' && targetColumnId !== '__select__') {
                              const newOrder = [...table.getState().columnOrder];
                              const fromIndex = newOrder.indexOf(draggedColumnId);
                              const toIndex = newOrder.indexOf(targetColumnId);
                              newOrder.splice(fromIndex, 1);
                              newOrder.splice(toIndex, 0, draggedColumnId);
                              table.setColumnOrder(newOrder);
                            }
                          }}
                          data-pinned={header.column.getIsPinned() === 'left' ? 'left' : undefined}
                          style={{
                            width: `var(--col-${column.id}-size)`,
                            minWidth: `var(--col-${column.id}-size)`,
                            maxWidth: `var(--col-${column.id}-size)`,
                            ...header.column.getSize() && { width: `${header.column.getSize()}px` },
                            left: header.column.getIsPinned() === 'left' ? 0 : undefined,
                            position: header.column.getIsPinned() === 'left' ? 'sticky' : undefined,
                            zIndex: header.column.getIsPinned() === 'left' ? 2 : 1,
                          }}
                        >
                          <div className="flex items-center justify-between w-full h-full cursor-pointer select-none py-0" onClick={(e) => {
                              if (isResizingRef.current) {
                                e.preventDefault();
                                e.stopPropagation();
                                return; // 🧱 Skip sort if resizing just happened
                              }
                              column.getToggleSortingHandler()?.(e);
                            }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[column.getIsSorted() as string] ?? ''}
                            {column.getCanResize() && (
                              <div onMouseDown={(e) => handleResizeStart(e, header)} className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-30 hover:bg-blue-300" style={{ transform: 'translateX(50%)' }} />
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody style={{ position: 'relative', height: totalSize }} className="relative z-10 border-collapse gap-0">
                {rows.length === 0 ? (
                  <TableRow className="flex w-full h-24 items-center justify-center">
                    <TableCell colSpan={table.getVisibleLeafColumns().length} className="text-left w-full border-t border-black py-8 text-xl font-semibold text-foreground" style={{ justifyContent: 'left' }}>
                      No results
                    </TableCell>
                  </TableRow>
                ) : (
                  virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <TableRow key={row.id} style={{ position: 'absolute', transform: `translateY(${virtualRow.start}px)`, left: 0, right: 0, display: 'flex', height: '24px' }} className={clsx(row.getIsSelected() ? 'bg-muted-foreground hover:bg-muted-foreground' : 'hover:bg-muted-foreground')}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-1 border border-primary bg-background" data-pinned={cell.column.getIsPinned() === 'left' ? 'left' : undefined} style={{
                            ...cell.column.getSize() && { width: `${cell.column.getSize()}px` },
                            left: cell.column.getIsPinned() === 'left' ? 0 : undefined,
                            position: cell.column.getIsPinned() === 'left' ? 'sticky' : undefined,
                            zIndex: cell.column.getIsPinned() === 'left' ? 1 : 0,
                            width: `var(--col-${cell.column.id}-size)`,
                            minWidth: `var(--col-${cell.column.id}-size)`,
                            maxWidth: `var(--col-${cell.column.id}-size)`,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            height: '24px',
                            alignItems: 'center',
                            justifyContent: cell.column.id === '__select__' ? 'center' : 'flex-start',
                          }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            <div ref={resizeLineRef} className="absolute top-0 bottom-0 w-[2px] bg-blue-600 opacity-50 pointer-events-none z-40" style={{ display: 'none' }} />
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="bg-secondary py-3 border-t z-10 shadow-sm border-black w-full" ref={footerRef}>
          <div className="flex flex-col md:flex-row justify-between items-center px-4 space-y-2 md:space-y-0">
            <div>
              <div>Showing {start}–{end} of {totalRows} results</div>
            </div>
            <div className="flex items-center space-x-2 mx-10">
              {(() => {
                const pageCount = Math.ceil(totalItems / pageSize);
                const current = pageIndex; // zero-based
                const siblingCount = 2; // pages around current

                const pages: (number | string)[] = [];

                const leftSibling = Math.max(current - siblingCount, 0);
                const rightSibling = Math.min(current + siblingCount, pageCount - 1);

                // always show first page
                pages.push(0);

                if (leftSibling > 1) pages.push('...'); // ellipsis after first

                for (let i = leftSibling; i <= rightSibling; i++) {
                  if (i !== 0 && i !== pageCount - 1) pages.push(i);
                }

                if (rightSibling < pageCount - 2) pages.push('...'); // ellipsis before last
                if (pageCount > 1) pages.push(pageCount - 1); // always show last page

                return (
                  <>
                    <button
                      onClick={() => onPageChange?.(pageIndex - 1)}
                      disabled={pageIndex === 0}
                      className="px-2 py-1 border rounded border-primary"
                    >
                      Prev
                    </button>

                    {pages.map((p, idx) =>
                      p === '...' ? (
                        <span key={idx} className="px-2 py-1">
                          …
                        </span>
                      ) : (
                        <button
                          key={idx}
                          onClick={() => onPageChange?.(p as number)}
                          className={`font-bold px-2 py-1 border rounded mx-[2px] ${
                            pageIndex === p
                              ? "bg-secondary text-primary border-primary"
                              : "bg-primary text-secondary hover:bg-secondary hover:text-primary hover:border-primary"
                          }`}
                        >
                          {(p as number) + 1}
                        </button>
                      )
                    )}

                    <button
                      onClick={() => onPageChange?.(pageIndex + 1)}
                      disabled={pageIndex + 1 >= pageCount}
                      className="px-2 py-1 border rounded border-primary"
                    >
                      Next
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// download helper
function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
