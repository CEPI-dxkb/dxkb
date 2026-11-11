import { useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  ColumnSizes,
  ColumnWidths,
  DataTableInstance,
  DataTableProps,
} from "./data-table";
import { clsx } from "cn";

interface DataTableHeaderProps {
  table: DataTableInstance;
  columnSizes: ColumnSizes;
  onColumnOrderChange?: DataTableProps["onColumnOrderChange"];
  resizingColumnId?: string;
  widthSettings?: ColumnWidths;
  onResizeStart: (
    columnId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => void;
}

/**
 * A press this close to the content edge is a resize that missed the handle,
 * not a reorder; the guard shrinks to a quarter of the width on narrow columns.
 */
const reorderEdgeGuard = 12;

export function DataTableHeader({
  table,
  columnSizes,
  onColumnOrderChange,
  resizingColumnId,
  widthSettings,
  onResizeStart,
}: DataTableHeaderProps) {
  // Extracted out of useDataTableContent ("use no memo"): the compiler would
  // otherwise key this on `table` identity alone, which is only unstable by
  // accident (see the useTable call in data-table.tsx).
  "use no memo";

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const justResizedRef = useRef(false);
  // Without an `onColumnOrderChange` callback a drop has nowhere to land, so
  // the drag affordance is withheld.
  const canReorder = Boolean(onColumnOrderChange);
  const isResizingAny = Boolean(resizingColumnId);
  const pressXRef = useRef<number | null>(null);
  // Capture retargets the press's click to the handle; the window below still
  // swallows a click on the sort button within 100 ms of a resize, as WebKit
  // has retargeted clicks differently before.
  const markJustResized = () => {
    justResizedRef.current = true;
    setTimeout(() => {
      justResizedRef.current = false;
    }, 100);
  };

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
    <TableHeader variant="muted" className="sticky top-0 z-30">
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          key={headerGroup.id}
          variant="muted-header"
          className="flex"
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
                variant="divider-strong-muted"
                className={clsx(
                  "group w-(--col-size) min-w-(--col-size) grow-(--col-grow) last:mr-2",
                  column.id === "__select__"
                    ? "sticky left-0 z-1 flex h-auto! items-center justify-center p-0"
                    : "relative h-auto! min-h-7! cursor-pointer px-2 py-0 align-middle whitespace-normal",
                )}
                style={
                  {
                    "--col-size": columnSizes[column.id].size,
                    "--col-grow": columnSizes[column.id].grow,
                  } as CSSProperties
                }
              >
                {column.id === "__select__" ? (
                  <div className="flex size-full items-center justify-center py-0">
                    <table.FlexRender header={header} />
                  </div>
                ) : (
                  <>
                    <div
                      className={clsx(
                        "relative flex size-full items-center py-0 pr-0.5 text-xs leading-tight font-bold",
                        canReorder && "cursor-move",
                        draggedColumn === column.id && "opacity-50",
                      )}
                      draggable={canReorder}
                      {...(canReorder && {
                        onMouseDown: (event: React.MouseEvent) => {
                          pressXRef.current = event.clientX;
                        },
                        onDragStart: (event: React.DragEvent) => {
                          const pressX = pressXRef.current;
                          const cell = event.currentTarget.getBoundingClientRect();
                          const guard = Math.min(
                            reorderEdgeGuard,
                            cell.width / 4,
                          );
                          if (
                            isResizingAny ||
                            (pressX !== null &&
                              cell.width > 0 &&
                              (pressX - cell.left < guard ||
                                cell.right - pressX < guard))
                          ) {
                            event.preventDefault();
                            return;
                          }
                          setDraggedColumn(column.id);
                          event.dataTransfer.effectAllowed = "move";
                        },
                        onDragOver: (event: React.DragEvent) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        },
                        onDrop: (event: React.DragEvent) => {
                          handleDrop(event, column.id);
                        },
                        onDragEnd: () => {
                          setDraggedColumn(null);
                        },
                      })}
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
                          <ChevronUp className="ml-0.5 inline-block size-3.5 shrink-0 stroke-3 align-text-bottom text-info" />
                        )}
                        {column.getIsSorted() === "desc" && (
                          <ChevronDown className="ml-0.5 inline-block size-3.5 shrink-0 stroke-3 align-text-bottom text-info" />
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
                        aria-valuenow={
                          widthSettings?.[column.id] ?? column.getSize()
                        }
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
                        onPointerDown={(event) => {
                          justResizedRef.current = false;
                          onResizeStart(column.id, event);
                        }}
                        onPointerUp={markJustResized}
                        onPointerCancel={markJustResized}
                        className="absolute top-0 right-0 z-30 flex h-full w-4 translate-x-1/2 cursor-col-resize touch-none select-none"
                      >
                        <div
                          className={clsx(
                            "mx-auto h-full w-1 transition-opacity",
                            resizingColumnId === column.id
                              ? "bg-info opacity-100"
                              : isResizingAny
                                ? "bg-muted-foreground opacity-0"
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
