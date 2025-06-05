'use client';

import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  flexRender,
  PaginationState,
} from '@tanstack/react-table';
import { useState, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../ui/table';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

interface DataTableProps {
  id: string;
  data: Record<string, any>[];
  columns: Record<string, string>; // key = field, value = label
}

function DraggableHeader({
  columnId,
  children,
}: {
  columnId: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: columnId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move bg-white select-none"
    >
      {children}
    </TableHead>
  );
}

export function DataTable({ id, data, columns }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 200,
  });

  const columnDefs = useMemo<ColumnDef<any, any>[]>(() => {
    return Object.entries(columns).map(([accessorKey, header]) => ({
      accessorKey,
      header,
      id: accessorKey,
      cell: info => info.getValue(),
    }));
  }, [columns]);

  const defaultOrder = useMemo(() => Object.keys(columns), [columns]);
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultOrder);

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      pagination,
      sorting,
      columnOrder,
    },
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
  });

  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col px-4 pt-4">
      <div className="w-[90%] h-full overflow-auto rounded border border-gray-300 mx-auto flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) {
              const oldIndex = columnOrder.indexOf(active.id as string);
              const newIndex = columnOrder.indexOf(over.id as string);
              const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
              setColumnOrder(newOrder);
            }
          }}
        >
          <Table className="text-sm w-full border-collapse rounded-md shadow pt-0">
            <TableHeader className="sticky top-0 z-10 bg-yellow-100 pt-0 mt-0">
              <SortableContext
                items={columnOrder}
                strategy={horizontalListSortingStrategy}
              >
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <DraggableHeader
                        key={header.id}
                        columnId={header.column.id}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </DraggableHeader>
                    ))}
                  </TableRow>
                ))}
              </SortableContext>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DndContext>

        <div className="mt-2 sticky bottom-0 bg-white py-2 border-t z-10 shadow">
          <div className="flex justify-between items-center">
            <div>
              Showing {table.getRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} results
            </div>
            <div className="space-x-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
