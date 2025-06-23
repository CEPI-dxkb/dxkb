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
} from '@tanstack/react-table';
import { useMemo, useRef, useState, useEffect, useLayoutEffect  } from 'react';
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
}

export function DataTable({ id, data, columns }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 200,
  });
  const [columnOrder, setColumnOrder] = useState(() => [
    '__select__',
    ...columns.map((col) => col.id),
  ]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(columns.map((col) => [col.id, col.visible !== false]))
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const resizeLineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const controlsHeight = controlsRef.current?.offsetHeight || 0;
      const footerHeight = footerRef.current?.offsetHeight || 0;
      const viewportHeight = window.innerHeight;
      const padding = 32;
      setAvailableHeight(viewportHeight - controlsHeight - footerHeight - padding);
    };
  
    measure();
  
    const roControls = new ResizeObserver(measure);
    const roFooter = new ResizeObserver(measure);
    if (controlsRef.current) roControls.observe(controlsRef.current);
    if (footerRef.current) roFooter.observe(footerRef.current);
    window.addEventListener('resize', measure);
  
    return () => {
      roControls.disconnect();
      roFooter.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [
    data.length,                        // when rows load
    pagination.pageIndex,              // when page changes
    pagination.pageSize,               // when page size changes
    columnVisibility,                  // when columns show/hide
  ]);

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
      document.addEventListener('mousedown', handleClickOutside);
    }
  
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnMenu]);
  
  useEffect(() => {
    const measure = () => {
      const controlsHeight = controlsRef.current?.offsetHeight || 0;
      const footerHeight = footerRef.current?.offsetHeight || 0;
      const viewportHeight = window.innerHeight;
      setAvailableHeight(viewportHeight - controlsHeight - footerHeight - 32); // add some extra padding
    };
  
    // Delay measurement slightly to allow layout to settle
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
  
  const columnDefs = useMemo<ColumnDef<any, any>[]>(() => {
    const checkboxColumn: ColumnDef<any> = {
      id: '__select__',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={(e) => {
            e.stopPropagation();
            table.toggleAllRowsSelected();
          }}
          className="cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={(e) => {
            e.stopPropagation();
            row.toggleSelected();
          }}
          className="cursor-pointer"
        />
      ),
      enableResizing: false,
      size: 40,
    };

    return [
      checkboxColumn,
      ...columns.map((col) => ({
        accessorKey: col.id,
        header: col.label,
        cell: (info) => info.getValue(),
        size: 200,
        enableResizing: true,
        enableSorting: true,
      })),
    ];
  }, [columns]);

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      sorting,
      pagination,
      columnOrder,
      columnVisibility,
      columnSizing,
      rowSelection,
    },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((prev) => {
        const newVisibility = typeof updater === 'function' ? updater(prev) : updater;
        return { ...newVisibility };
      });
    
      // Trigger a recalculation of column sizing on visibility toggle
      setColumnSizing((prev) => {
        const updated = { ...prev };
        table.getAllLeafColumns().forEach((col) => {
          if (!updated[col.id]) {
            updated[col.id] = col.getSize();
          }
        });
        return updated;
      });
    },
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: 'onEnd',
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: string } = {};
    for (const header of headers) {
      colSizes[`--col-${header.column.id}-size`] = `${header.column.getSize()}px`;
    }
    return colSizes;
  }, [table.getState().columnSizing, table.getState().columnSizingInfo]);

  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 34,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const handleResizeStart = (event: React.MouseEvent, header: any) => {
    event.preventDefault();

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

      setColumnSizing((prev) => ({
        ...prev,
        [column.id]: finalSize,
      }));

      if (resizeLineRef.current) {
        resizeLineRef.current.style.display = 'none';
      }

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDownload = (format: 'csv' | 'txt', onlySelected = false) => {
    const allCols = table.getAllLeafColumns();
    const visibleCols = allCols.filter(col => col.id !== '__select__');
  
    const headers = visibleCols.map(col => col.columnDef.header as string);
  
    const rowsToExport = onlySelected
      ? table.getSelectedRowModel().rows
      : table.getPrePaginationRowModel().rows;
  
    const content = [
      headers.join(','), // header row
      ...rowsToExport.map(row =>
        visibleCols.map(col => {
          const val = row.getValue(col.id);
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      )
    ].join('\n');
  
    downloadFile(`table-export.${onlySelected ? 'selected-' : ''}${format}`, content);
  };
      
  return (
    <div className="flex flex-col px-4 pt-4 text-xs relative items-center">
      <div className="w-[85%] flex justify-end mb-2 gap-2 z-50" ref={controlsRef}>
          <div className="relative inline-block text-left" ref={columnMenuRef}>
            <button
              className="flex justify-end w-full rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setShowColumnMenu(prev => !prev)}
            >
              Columns ▾
            </button>

            {showColumnMenu && (
              <div className="absolute left-0 mt-1 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1 max-h-64 overflow-auto text-xs">
                  {table.getAllColumns()
                    .filter(col => col.id !== '__select__')
                    .map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={() => column.toggleVisibility()}
                        />
                        <span>{column.columnDef.header as string}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Download buttons */}
          <button
            onClick={() => handleDownload('csv')}
            className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Download (CSV)
          </button>
          <button
            onClick={() => handleDownload('txt')}
            className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Download (TXT)
          </button>
          {table.getSelectedRowModel().rows.length > 0 && (
            <>
              <button
                onClick={() => handleDownload('csv', true)}
                className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Download Selected (CSV)
              </button>
              <button
                onClick={() => handleDownload('txt', true)}
                className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Download Selected (TXT)
              </button>
            </>
          )}
        </div>
      <div className="w-[90%] flex flex-col border border-gray-500 rounded relative"
            style={{ height: availableHeight ? `${availableHeight}px` : 'auto' }}
            >
        <div
          className="flex-1 overflow-auto relative"
          ref={tableContainerRef}
          style={{
            height: '100%',
            paddingBottom: '52px', // Push scrollbar above footer
          }}
        >
          <div className="min-w-max relative" style={columnSizeVars}>
            <Table className="w-full table-auto text-xs border-collapse" style={{ borderSpacing: 0 }}>
            <TableHeader
              ref={headerRef}
              className="sticky top-0 z-30 bg-gray-500 text-gray-800 uppercase border-black"
            >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="flex border-t border-b border-black">
                    {headerGroup.headers.map((header) => {
                      const column = header.column;
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className="relative px-2 py-0 text-sm font-bold bg-gray-300 border-r border-l border-black leading-none align-middle"
                          style={{
                            width: `var(--col-${column.id}-size)`,
                            minWidth: `var(--col-${column.id}-size)`,
                            maxWidth: `var(--col-${column.id}-size)`,
                          }}
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

                            if (draggedColumnId && draggedColumnId !== targetColumnId) {
                              const newOrder = [...table.getState().columnOrder];
                              const fromIndex = newOrder.indexOf(draggedColumnId);
                              const toIndex = newOrder.indexOf(targetColumnId);

                              newOrder.splice(fromIndex, 1);
                              newOrder.splice(toIndex, 0, draggedColumnId);

                              table.setColumnOrder(newOrder);
                            }
                          }}
                        >
                          <div
                            className="flex items-center justify-between w-full h-full cursor-pointer select-none py-[6px]"
                            onClick={column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[column.getIsSorted() as string] ?? ''}
                            {column.getCanResize() && (
                              <div
                                onMouseDown={(e) => handleResizeStart(e, header)}
                                className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-30 hover:bg-blue-300"
                                style={{ transform: 'translateX(50%)' }}
                              />
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody
                style={{
                  position: 'relative',
                  height: totalSize,
                }}
                className="relative z-10"
              >
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      style={{
                        position: 'absolute',
                        transform: `translateY(${virtualRow.start}px)`,
                        left: 0,
                        right: 0,
                        display: 'flex',
                      }}
                      className={clsx(
                        row.getIsSelected()
                          ? 'bg-yellow-100 hover:bg-yellow-100' // lock in yellow background
                          : 'hover:bg-yellow-100' // only apply white hover if not selected
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            width: `var(--col-${cell.column.id}-size)`,
                            minWidth: `var(--col-${cell.column.id}-size)`,
                            maxWidth: `var(--col-${cell.column.id}-size)`,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            border: '1px solid #000000',
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div
              ref={resizeLineRef}
              className="absolute top-0 bottom-0 w-[2px] bg-blue-600 opacity-50 pointer-events-none z-40"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="bg-white py-3 border-t z-10 shadow-sm border-black w-full"ref={footerRef}>
          <div className="flex flex-col md:flex-row justify-between items-center px-4 space-y-2 md:space-y-0">
            <div>
              {(() => {
                const pageIndex = table.getState().pagination.pageIndex;
                const pageSize = table.getState().pagination.pageSize;
                const totalRows = table.getFilteredRowModel().rows.length;
                const start = pageIndex * pageSize + 1;
                const end = Math.min(start + pageSize - 1, totalRows);
                return <div>Showing {start}–{end} of {totalRows} results</div>;
              })()}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                {'<'}
              </button>
              {(() => {
                const pageCount = table.getPageCount();
                const currentPage = table.getState().pagination.pageIndex;
                const pages: number[] = [];

                if (pageCount > 0) pages.push(0);
                for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                  if (i > 0 && i < pageCount - 1) pages.push(i);
                }
                if (pageCount > 1) pages.push(pageCount - 1);
                const uniquePages = [...new Set(pages)].sort((a, b) => a - b);

                return uniquePages.map((page, idx) => {
                  const prev = uniquePages[idx - 1];
                  const showDots = prev !== undefined && page - prev > 1;
                  return (
                    <span key={page}>
                      {showDots && <span className="px-1">...</span>}
                      <button
                        onClick={() => table.setPageIndex(page)}
                        className={clsx(
                          'px-3 py-1 rounded border mx-1',
                          currentPage === page ? 'bg-gray-300 font-bold' : 'bg-white'
                        )}
                      >
                        {page + 1}
                      </button>
                    </span>
                  );
                });
              })()}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                {'>'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
