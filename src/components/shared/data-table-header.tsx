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
  /** The column a pointer drag is resizing, if any. */
  resizingColumnId?: string;
  /** Width settings during a pointer drag, reported by the handles. */
  widthSettings?: ColumnWidths;
  /** Starts a pointer resize of a column at the given pointer x. */
  onResizeStart: (
    columnId: string,
    clientX: number,
    pointer: "mouse" | "touch",
  ) => void;
}

/**
 * A press this close to a header's left or right edge (px) never starts a
 * column reorder: it is a resize that missed the handle.
 */
const reorderEdgeGuard = 12;

export function DataTableHeader({
  table,
  columnWidths,
  onColumnOrderChange,
  resizingColumnId,
  widthSettings,
  onResizeStart,
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
  // While a column is being resized, the pointer crosses other headers; their
  // hover bars stay hidden so only the dragged edge is drawn.
  const isResizingAny = Boolean(resizingColumnId);
  // Where the last press on a header landed, so a drag that starts from the
  // edge of a header (a resize that missed its handle) is not a reorder.
  const pressXRef = useRef<number | null>(null);

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
            // One entry point for both pointer kinds. The drag itself lives in
            // data-table.tsx (startPointerResize), which arms touchmove/touchend
            // or mousemove/mouseup by the kind passed here, so a touchstart
            // must say so — reporting it as a mouse press would leave the touch
            // path unarmed.
            const startResize = (
              event: React.MouseEvent | React.TouchEvent,
            ) => {
              event.stopPropagation();
              let clientX: number;
              if ("touches" in event) {
                const touch = event.touches[0] as Touch | undefined;
                if (!touch) return;
                clientX = touch.clientX;
              } else {
                if (event.button !== 0) return;
                // No text selection, focus change or native drag from the press.
                event.preventDefault();
                clientX = event.clientX;
              }
              justResizedRef.current = false;
              onResizeStart(
                column.id,
                clientX,
                event.type === "touchstart" ? "touch" : "mouse",
              );
              // Mirror that branch: the "just resized, swallow the next
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
                        onMouseDown: (event: React.MouseEvent) => {
                          pressXRef.current = event.clientX;
                        },
                        onDragStart: (event: React.DragEvent) => {
                          const pressX = pressXRef.current;
                          const cell = event.currentTarget.getBoundingClientRect();
                          if (
                            isResizingAny ||
                            (pressX !== null &&
                              cell.width > 0 &&
                              (pressX - cell.left < reorderEdgeGuard ||
                                cell.right - pressX < reorderEdgeGuard))
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
                        onMouseDown={startResize}
                        onTouchStart={startResize}
                        // 16px wide, centred on the edge: a press that lands a
                        // little off the line still resizes.
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
