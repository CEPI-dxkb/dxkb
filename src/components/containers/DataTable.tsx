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
      cell: ({ row }) => (
        <div className="flex justify-center items-center w-full h-full">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={(e) => {
              e.stopPropagation();
              row.toggleSelected();
            }}
            className="cursor-pointer m-0 p-0"
          />
        </div>
      ),
      enableResizing: false,
      size: 40,
    };
    return [
      checkboxColumn,
      ...columns.map((col) => ({
        accessorKey: col.id,
        header: col.label,
        cell: (info) => {
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
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId);
          const b = rowB.getValue(columnId);
      
          // Treat empty/undefined/null as "last"
          const aIsEmpty = a === undefined || a === null || a === '';
          const bIsEmpty = b === undefined || b === null || b === '';
      
          if (aIsEmpty && bIsEmpty) return 0;
          if (aIsEmpty) return 1;
          if (bIsEmpty) return -1;
      
          // Normal string/number compare
          return a > b ? 1 : a < b ? -1 : 0;
        },
      }))
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
    enableSortingRemoval: false,
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
    estimateSize: () => 24,
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
    <div className="flex flex-col h-full w-full text-xs relative items-center">
      <div className="w-[100%] flex justify-end mb-2 z-50" ref={controlsRef}>
          <div className="relative inline-block text-left" ref={columnMenuRef}>
            <button
              className="flex justify-end w-full rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
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
                        className="flex items-center space-x-2 px-2 py-1 hover:bg-muted-foreground cursor-pointer text-black"
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
            className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2 ml-2"
          >
            Download (CSV)
          </button>
          <button
            onClick={() => handleDownload('txt')}
            className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
          >
            Download (TXT)
          </button>
          {table.getSelectedRowModel().rows.length > 0 && (
            <>
              <button
                onClick={() => handleDownload('csv', true)}
                className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
              >
                Download Selected (CSV)
              </button>
              <button
                onClick={() => handleDownload('txt', true)}
                className="rounded border border-gray-400 shadow-sm px-2 py-1 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 mr-2"
              >
                Download Selected (TXT)
              </button>
            </>
          )}
      </div>
      <div className="w-full flex flex-col border border-gray-500 rounded relative h-full overflow-hidden">
      <div
        className="flex-1 overflow-auto relative"
        ref={tableContainerRef}
        style={{
          maxHeight: '100%',
          paddingBottom: '52px', // leave room for footer
        }}
      >
        <div className="min-w-max relative" style={columnSizeVars}>
          <Table className="w-full table-auto text-xs border-collapse" style={{ borderSpacing: 0 }}>
            <TableHeader
              ref={headerRef}
              className="sticky top-0 z-30 bg-primary text-secondary uppercase border-black"
            >
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
                            column.id === '__select__'
                              ? 'p-0 flex justify-center items-center' // ✅ center checkbox
                              : 'px-2 py-0 text-sm font-bold leading-none align-middle'
                          )}
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

                            if (
                              draggedColumnId &&
                              draggedColumnId !== targetColumnId &&
                              draggedColumnId !== '__select__' &&
                              targetColumnId !== '__select__'
                            ) {
                            
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
                            className="flex items-center justify-between w-full h-full cursor-pointer select-none py-0"
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
                className="relative z-10 border-collapse gap-0"
              >
                {rows.length === 0 ? (
                <TableRow className="flex w-full h-24 items-center justify-center">
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="text-center w-full border-t border-black py-8 text-xl font-semibold text-foreground"
                    style={{ justifyContent: 'center' }}
                  >
                    No results
                  </TableCell>
                </TableRow>
              ) : (
                virtualRows.map((virtualRow) => {
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
                        height: '24px',
                      }}
                      className={clsx(
                        row.getIsSelected()
                          ? 'bg-muted-foreground hover:bg-muted-foreground' // lock in yellow background
                          : 'hover:bg-muted-foreground' // only apply white hover if not selected
                      )}
                      
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className='py-1 border border-primary'
                          style={{
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
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
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
        <div className="bg-secondary py-3 border-t z-10 shadow-sm border-black w-full"ref={footerRef}>
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
                className="px-2 py-1 border border-primary disabled:opacity-50"
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
                          'px-3 py-1 border mx-1 bg-background text-foreground',
                          currentPage === page ? 'bg-muted-foreground font-bold' : 'bg-background'
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
                className="px-2 py-1 border border-primary disabled:opacity-50"
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
