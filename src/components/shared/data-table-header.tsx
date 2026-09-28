import { useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  ColumnWidths,
  DataTableInstance,
  DataTableProps,
} from "./data-table";
import { clsx } from "cn";

interface DataTableHeaderProps {
  table: DataTableInstance;
  columnWidths: ColumnWidths;
  onColumnOrderChange?: DataTableProps["onColumnOrderChange"];
}

export function DataTableHeader({
  table,
  columnWidths,
  onColumnOrderChange,
}: DataTableHeaderProps) {
  // Extracted out of useDataTableContent, which carries "use no memo". The
  // compiler otherwise keys the header cells (sort chevrons included) on
  // `table` identity alone, and the table instance is only unstable by
  // accident (see the useTable call in data-table.tsx) — memoize the options
  // there and the sort indicators freeze.
  "use no memo";

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const justResizedRef = useRef(false);
  // Reordering is only possible when the parent owns the column order:
  // `data-table.tsx` passes `onColumnOrderChange: undefined` to `useTable`
  // when this prop is absent, which makes `table.setColumnOrder` a no-op too.
  // Without a callback there is nowhere for a drop to land, so we withhold the
  // drag affordance entirely rather than show a grab cursor that discards the
  // drop.
  const canReorder = Boolean(onColumnOrderChange);

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
            // One entry point for both pointer kinds. TanStack's resize handler
            // branches on `isTouchStartEvent` to decide whether to arm
            // touchmove/touchend or mousemove/mouseup, so a touchstart must
            // reach it directly — forwarding a synthetic mousedown would leave
            // the touch path permanently unarmed.
            const startResize = (
              event: React.MouseEvent | React.TouchEvent,
            ) => {
              event.stopPropagation();
              justResizedRef.current = false;
              header.getResizeHandler()(event);
              // Mirror TanStack's branch: the "just resized, swallow the next
              // click" window has to close on whichever gesture actually ends.
              // Listening only for mouseup meant a touch resize-drag left the
              // flag false and fell through to the sort toggle below.
              const endEventNames =
                event.type === "touchstart"
                  ? (["touchend", "touchcancel"] as const)
                  : (["mouseup"] as const);
              const onEnd = () => {
                justResizedRef.current = true;
                setTimeout(() => {
                  justResizedRef.current = false;
                }, 100);
                for (const name of endEventNames) {
                  window.removeEventListener(name, onEnd);
                }
              };
              for (const name of endEventNames) {
                window.addEventListener(name, onEnd);
              }
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
                  "group w-(--col-size) max-w-(--col-size) min-w-(--col-size)",
                  column.id === "__select__"
                    ? "sticky left-0 z-1 flex h-auto! items-center justify-center p-0"
                    : "relative h-auto! min-h-7! cursor-pointer px-2 py-0 align-middle whitespace-normal",
                )}
                style={
                  {
                    "--col-size": `${String(columnWidths[column.id])}px`,
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
                      // The header typography sits here rather than on the
                      // TableHead: this wrapper holds all of the cell's text.
                      className={clsx(
                        "relative flex size-full items-center py-0 pr-0.5 text-xs leading-tight font-bold",
                        canReorder && "cursor-move",
                        draggedColumn === column.id && "opacity-50",
                      )}
                      draggable={canReorder}
                      {...(canReorder && {
                        onDragStart: (event: React.DragEvent) => {
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
                        onMouseDown={startResize}
                        onTouchStart={startResize}
                        className="absolute top-0 right-0 z-30 flex h-full w-2 translate-x-1/2 cursor-col-resize touch-none select-none"
                      >
                        <div
                          className={clsx(
                            "mx-auto h-full w-1 transition-opacity",
                            header.column.getIsResizing()
                              ? "bg-info opacity-100"
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
