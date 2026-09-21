import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataTableInstance, DataTableProps } from "./data-table";

interface DataTableHeaderProps {
  table: DataTableInstance;
  onColumnOrderChange?: DataTableProps["onColumnOrderChange"];
}

export function DataTableHeader({
  table,
  onColumnOrderChange,
}: DataTableHeaderProps) {
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const justResizedRef = useRef(false);

  const handleDrop = (event: React.DragEvent, targetColumnId: string) => {
    event.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      return;
    }

    const columnIds = table.getAllLeafColumns().map((column) => column.id);
    const draggedIndex = columnIds.indexOf(draggedColumn);
    const targetIndex = columnIds.indexOf(targetColumnId);
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = [...columnIds];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    onColumnOrderChange?.(newOrder);
    setDraggedColumn(null);
  };

  return (
    <TableHeader
      className="border-border bg-muted text-foreground"
      style={{ position: "sticky", top: 0, zIndex: 30 }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          key={headerGroup.id}
          className="border-border bg-muted flex border-y"
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
                  "group border-foreground/20 bg-muted text-foreground relative border-r",
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
                  <div className="flex size-full items-center justify-center py-0">
                    <table.FlexRender header={header} />
                  </div>
                ) : (
                  <>
                    <div
                      className="relative flex size-full items-center py-0 pr-0.5"
                      draggable={true}
                      onDragStart={(event) => {
                        setDraggedColumn(column.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        handleDrop(event, column.id);
                      }}
                      onDragEnd={() => {
                        setDraggedColumn(null);
                      }}
                      style={{
                        cursor: "move",
                        opacity: draggedColumn === column.id ? 0.5 : 1,
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
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          justResizedRef.current = false;
                          header.getResizeHandler()(event);
                          const onUp = () => {
                            justResizedRef.current = true;
                            setTimeout(() => {
                              justResizedRef.current = false;
                            }, 100);
                            window.removeEventListener("mouseup", onUp);
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
  );
}
