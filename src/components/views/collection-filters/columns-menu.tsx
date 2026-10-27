"use client";

// The toolbar's Columns control. Shown columns are listed in display order and
// reorder by dragging their grip (pointer events, with a drop line) or by
// Alt+↑/↓ on the highlighted row; hidden columns are listed A–Z below and come
// back at the end of the shown order. Every change is one table-layout write.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Columns3, GripVertical, Plus, Search, SearchX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CheckMark, EmptyState, navigationTarget } from "./facet-value-list";
import type { CollectionColumnControls, CollectionColumnOption } from "./types";

type ColumnRow = CollectionColumnOption & { group: "shown" | "hidden" };

/** Distance from the list's top/bottom edge where a drag scrolls it, in px. */
const autoScrollZone = 32;
/** Fastest auto-scroll step per frame, in px. */
const autoScrollStep = 12;
/** How long a moved row keeps its highlight, in ms. */
const movedFlashMs = 700;

/**
 * The shown-list index a row dragged from `from` lands at for the insertion
 * index `to`: past its own slot, one earlier.
 */
function dropIndex(from: number, to: number) {
  return to > from ? to - 1 : to;
}

interface DragState {
  id: string;
  /** Index in the shown list the row was picked up from. */
  from: number;
  /** Insertion index (0..shown.length) the drop line marks. */
  to: number;
  /** Ghost row's top, in the list's scroll coordinates. */
  ghostY: number;
  /** Drop line's top, in the list's scroll coordinates. */
  lineY: number;
}

export function ColumnsMenu({
  columns,
  setColumns,
  resetColumns,
}: CollectionColumnControls) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [movedId, setMovedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const movedTimer = useRef<number | undefined>(undefined);
  const dragRef = useRef<{
    id: string;
    from: number;
    grabOffset: number;
    clientY: number;
    frame: number;
  } | null>(null);
  const listId = useId();
  const hintId = useId();

  useEffect(
    () => () => {
      window.clearTimeout(movedTimer.current);
      if (dragRef.current) cancelAnimationFrame(dragRef.current.frame);
    },
    [],
  );

  const shown = columns.filter((column) => column.visible);
  const hidden = columns
    .filter((column) => !column.visible)
    .sort((a, b) => a.label.localeCompare(b.label));
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = (column: CollectionColumnOption) =>
    !searching ||
    column.label.toLowerCase().includes(needle) ||
    column.id.toLowerCase().includes(needle);
  const shownRows: ColumnRow[] = shown
    .filter(matches)
    .map((column) => ({ ...column, group: "shown" }));
  const hiddenRows: ColumnRow[] = hidden
    .filter(matches)
    .map((column) => ({ ...column, group: "hidden" }));
  const rows = [...shownRows, ...hiddenRows];
  const activeIndex = Math.max(
    0,
    rows.findIndex((row) => row.id === activeId),
  );
  const activeRow = rows.at(activeIndex);
  const customised = columns.some(
    (column, index) =>
      column.visible !== column.defaultVisible || column.defaultIndex !== index,
  );
  const optionId = (id: string) => `${listId}-${id}`;

  const announce = (message: string) => {
    // A repeated message is still read: clear, then set on the next frame.
    setAnnouncement("");
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  };

  const flashMoved = (id: string) => {
    window.clearTimeout(movedTimer.current);
    setMovedId(id);
    movedTimer.current = window.setTimeout(() => {
      setMovedId(null);
    }, movedFlashMs);
  };

  const scrollRowIntoView = (id: string) => {
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-column="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  /**
   * Writes a new shown order. Hidden columns keep their slots in the full
   * order, so "Show all" later puts them back where they were.
   */
  const writeShownOrder = (nextShown: string[]) => {
    const queue = [...nextShown];
    setColumns({
      order: columns.map((column) =>
        column.visible ? (queue.shift() ?? column.id) : column.id,
      ),
    });
  };

  const moveShown = (from: number, to: number) => {
    if (to === from || to < 0 || to >= shown.length) return;
    const ids = shown.map((column) => column.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    writeShownOrder(ids);
    flashMoved(moved);
    scrollRowIntoView(moved);
    announce(
      `${shown[from].label} moved to position ${String(to + 1)} of ${String(shown.length)}.`,
    );
  };

  /**
   * A row leaving its group hands the highlight to the next row in that group
   * (else the previous one), if it had the highlight or nothing did.
   */
  const highlightNeighbour = (row: ColumnRow, group: ColumnRow[]) => {
    if (row.id !== activeId && activeId !== null) return;
    const index = group.findIndex((candidate) => candidate.id === row.id);
    const neighbour = group.at(index + 1) ?? group.at(index - 1);
    setActiveId(neighbour && neighbour.id !== row.id ? neighbour.id : null);
  };

  const hide = (row: ColumnRow) => {
    if (shown.length <= 1) {
      announce("At least one column stays shown.");
      return;
    }
    setColumns({ visibility: { [row.id]: false } });
    highlightNeighbour(row, shownRows);
    announce(`${row.label} hidden. ${String(shown.length - 1)} columns shown.`);
  };

  const show = (row: ColumnRow) => {
    // Appended after the last shown column; every other slot stays.
    const rest = columns.filter((column) => column.id !== row.id);
    const lastShown = rest.findLastIndex((column) => column.visible);
    const order = rest.map((column) => column.id);
    order.splice(lastShown + 1, 0, row.id);
    setColumns({ visibility: { [row.id]: true }, order });
    highlightNeighbour(row, hiddenRows);
    flashMoved(row.id);
    announce(
      `${row.label} shown at position ${String(shown.length + 1)} of ${String(shown.length + 1)}.`,
    );
  };

  const toggle = (row: ColumnRow) => {
    if (row.group === "shown") hide(row);
    else show(row);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) {
      // Clear the search first; a second Escape closes the menu.
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
      return;
    }
    if (rows.length === 0 || !activeRow) return;
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      if (activeRow.group === "hidden") {
        announce("Show the column first to reorder it.");
        return;
      }
      if (searching) {
        announce("Clear the search to reorder columns.");
        return;
      }
      const from = shown.findIndex((column) => column.id === activeRow.id);
      const to = from + (event.key === "ArrowUp" ? -1 : 1);
      if (to < 0 || to >= shown.length) {
        announce(
          `${activeRow.label} is already ${to < 0 ? "first" : "last"}.`,
        );
        return;
      }
      moveShown(from, to);
      return;
    }
    const target = navigationTarget(event.key, activeIndex, rows.length);
    if (target !== undefined) {
      event.preventDefault();
      const next = rows[target];
      setActiveId(next.id);
      scrollRowIntoView(next.id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      toggle(activeRow);
    }
  };

  // -------------------------------------------------------------------------
  // Pointer drag (shown rows only, from the grip)

  /** Where the drop line goes for a pointer at `clientY`, 0..shown.length. */
  const insertionIndex = (clientY: number) => {
    const list = listRef.current;
    if (!list) return 0;
    const elements = Array.from(
      list.querySelectorAll<HTMLElement>("[data-shown-index]"),
    );
    let index = 0;
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) index += 1;
    }
    return index;
  };

  const updateDrag = () => {
    const state = dragRef.current;
    const list = listRef.current;
    if (!state || !list) return;
    const bounds = list.getBoundingClientRect();
    const ghostY = Math.min(
      Math.max(state.clientY - bounds.top - state.grabOffset + list.scrollTop, 0),
      list.scrollHeight - 32,
    );
    const to = insertionIndex(state.clientY);
    const elements = list.querySelectorAll<HTMLElement>("[data-shown-index]");
    const last = elements.item(elements.length - 1);
    const lineY =
      to < elements.length
        ? elements.item(to).offsetTop - 1
        : last.offsetTop + last.offsetHeight - 1;
    setDrag({ id: state.id, from: state.from, to, ghostY, lineY });
  };

  const autoScroll = () => {
    const state = dragRef.current;
    const list = listRef.current;
    if (!state || !list) return;
    const bounds = list.getBoundingClientRect();
    const fromTop = state.clientY - bounds.top;
    const fromBottom = bounds.bottom - state.clientY;
    let delta = 0;
    if (fromTop < autoScrollZone) {
      delta = -Math.ceil(((autoScrollZone - fromTop) / autoScrollZone) * autoScrollStep);
    } else if (fromBottom < autoScrollZone) {
      delta = Math.ceil(((autoScrollZone - fromBottom) / autoScrollZone) * autoScrollStep);
    }
    if (delta !== 0) {
      list.scrollTop += delta;
      updateDrag();
    }
    state.frame = requestAnimationFrame(autoScroll);
  };

  const onGripPointerDown = (
    event: PointerEvent<HTMLSpanElement>,
    column: CollectionColumnOption,
    from: number,
  ) => {
    if (event.button !== 0 || searching) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const row = event.currentTarget.closest<HTMLElement>("[data-column]");
    const rowTop = row?.getBoundingClientRect().top ?? event.clientY;
    dragRef.current = {
      id: column.id,
      from,
      grabOffset: event.clientY - rowTop,
      clientY: event.clientY,
      frame: 0,
    };
    setActiveId(column.id);
    updateDrag();
    dragRef.current.frame = requestAnimationFrame(autoScroll);
  };

  const onGripPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    dragRef.current.clientY = event.clientY;
    updateDrag();
  };

  const endDrag = (commit: boolean) => {
    const state = dragRef.current;
    if (!state) return;
    cancelAnimationFrame(state.frame);
    dragRef.current = null;
    const to = insertionIndex(state.clientY);
    setDrag(null);
    if (!commit) return;
    const target = dropIndex(state.from, to);
    if (target !== state.from) moveShown(state.from, target);
  };

  const dropLineVisible =
    drag !== null && drag.to !== drag.from && drag.to !== drag.from + 1;
  const dragged = drag ? columns.find((column) => column.id === drag.id) : undefined;

  // -------------------------------------------------------------------------

  const renderRow = (row: ColumnRow) => {
    const isActive = row.id === activeRow?.id;
    const shownIndex =
      row.group === "shown" ? shown.findIndex((column) => column.id === row.id) : -1;
    const canDrag = row.group === "shown" && !searching;
    return (
      <div
        key={row.id}
        id={optionId(row.id)}
        role="option"
        aria-selected={row.visible}
        aria-label={
          row.group === "shown"
            ? `${row.label}, shown, position ${String(shownIndex + 1)} of ${String(shown.length)}`
            : `${row.label}, hidden`
        }
        data-column={row.id}
        data-shown-index={row.group === "shown" && !searching ? shownIndex : undefined}
        data-active={(isActive && drag === null) || undefined}
        data-moved={row.id === movedId || undefined}
        data-dragging={drag?.id === row.id || undefined}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onMouseMove={() => {
          if (drag === null && !isActive) setActiveId(row.id);
        }}
        onClick={() => {
          setActiveId(row.id);
          toggle(row);
        }}
        className={cn(
          "group/option relative mx-1 flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md pr-2.5 text-xs transition-colors duration-100 data-active:bg-foreground/5 data-dragging:opacity-35 data-moved:bg-primary/10",
          row.group === "shown" ? "pl-0.5" : "pl-2",
        )}
      >
        {row.group === "shown" ? (
          <span
            aria-hidden="true"
            title={canDrag ? "Drag to reorder" : "Clear the search to reorder"}
            onPointerDown={(event) => {
              onGripPointerDown(event, row, shownIndex);
            }}
            onPointerMove={onGripPointerMove}
            onPointerUp={() => {
              endDrag(true);
            }}
            onPointerCancel={() => {
              endDrag(false);
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            className={cn(
              "flex h-7 w-5 shrink-0 touch-none items-center justify-center rounded-sm text-muted-foreground/50 transition-colors duration-100",
              canDrag
                ? "cursor-grab group-data-active/option:text-muted-foreground hover:bg-foreground/5 hover:text-foreground active:cursor-grabbing"
                : "cursor-not-allowed opacity-40",
            )}
          >
            <GripVertical className="size-3.5" />
          </span>
        ) : null}
        <CheckMark checked={row.visible} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            row.group === "hidden" && "text-muted-foreground group-data-active/option:text-foreground",
          )}
          title={row.label}
        >
          <Highlight text={row.label} needle={needle} />
        </span>
        {row.group === "shown" ? (
          <span className="w-5 shrink-0 text-right text-3xs text-muted-foreground tabular-nums">
            {shownIndex + 1}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-0.5 text-3xs font-medium text-primary opacity-0 transition-opacity duration-100 group-data-active/option:opacity-100 dark:text-foreground">
            <Plus aria-hidden="true" className="size-3" />
            Show
          </span>
        )}
      </div>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setActiveId(null);
          endDrag(false);
        }
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Columns, ${String(shown.length)} of ${String(columns.length)} shown${customised ? ", customised" : ""}`}
            className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background pr-1.5 pl-2 text-xs font-medium text-foreground shadow-xs outline-none hover:bg-foreground/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-foreground/5"
          />
        }
      >
        <Columns3 aria-hidden="true" className="size-3.5" />
        Columns
        <span className="border-l border-border pl-1.5 text-2xs font-medium text-muted-foreground tabular-nums">
          {shown.length}/{columns.length}
        </span>
        {customised && (
          <span
            aria-hidden="true"
            title="Differs from the default columns"
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full border-2 border-background bg-primary"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        size="flush"
        variant="raised"
        className="w-90 overflow-hidden"
        initialFocus={inputRef}
      >
        <div className="flex h-105 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border pr-1.5 pl-3">
            <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Find a column"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeRow ? optionId(activeRow.id) : undefined}
              aria-autocomplete="list"
              aria-describedby={hintId}
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder={`Find among ${String(columns.length)} columns…`}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                setActiveId(null);
                if (listRef.current) listRef.current.scrollTop = 0;
              }}
              onKeyDown={onSearchKeyDown}
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <p id={hintId} className="sr-only">
            Up and down arrows move through the columns, Enter shows or hides
            the highlighted one, and Alt with up or down moves a shown column.
          </p>

          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Columns"
            aria-multiselectable="true"
            onMouseLeave={() => {
              if (drag === null) setActiveId(null);
            }}
            className={cn(
              "relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1",
              drag && "cursor-grabbing select-none",
            )}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={`No column matches “${query.trim()}”`}
                detail={`Searched the names of all ${String(columns.length)} columns.`}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                  >
                    Clear search
                  </Button>
                }
              />
            ) : (
              <>
                {shownRows.length > 0 && (
                  <RowGroup
                    label="Shown"
                    count={searching ? `${String(shownRows.length)} of ${String(shown.length)}` : String(shown.length)}
                    hint={searching ? "Clear search to reorder" : "Drag or Alt+↑↓ to reorder"}
                  >
                    {shownRows.map(renderRow)}
                  </RowGroup>
                )}
                {hiddenRows.length > 0 && (
                  <RowGroup
                    label="Hidden"
                    count={searching ? `${String(hiddenRows.length)} of ${String(hidden.length)}` : String(hidden.length)}
                    hint="A–Z · click to show"
                  >
                    {hiddenRows.map(renderRow)}
                  </RowGroup>
                )}
              </>
            )}

            {drag && dropLineVisible && (
              <span
                aria-hidden="true"
                style={{ "--column-drop-y": `${String(drag.lineY)}px` } as CSSProperties}
                className="pointer-events-none absolute inset-x-2 top-0 z-40 flex h-0.5 translate-y-(--column-drop-y) items-center rounded-full bg-primary"
              >
                <span className="-ml-1 size-2 rounded-full border-2 border-primary bg-popover" />
              </span>
            )}
            {drag && dragged && (
              <div
                aria-hidden="true"
                style={{ "--column-ghost-y": `${String(drag.ghostY)}px` } as CSSProperties}
                className="pointer-events-none absolute top-0 right-1 left-4 z-30 flex h-8 translate-y-(--column-ghost-y) items-center gap-2 rounded-md border border-primary/40 bg-popover/95 pr-2.5 pl-0.5 text-xs font-medium shadow-lg"
              >
                <span className="flex h-7 w-5 items-center justify-center text-foreground">
                  <GripVertical className="size-3.5" />
                </span>
                <CheckMark checked />
                <span className="min-w-0 flex-1 truncate">{dragged.label}</span>
                <span className="text-3xs text-muted-foreground tabular-nums">
                  {String(dropIndex(drag.from, drag.to) + 1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex h-9 shrink-0 items-center gap-0.5 border-t border-border pr-3 pl-1.5">
            <FooterAction
              disabled={hidden.length === 0}
              onClick={() => {
                setColumns({
                  visibility: Object.fromEntries(
                    columns.map((column) => [column.id, true]),
                  ),
                });
                announce(`All ${String(columns.length)} columns shown.`);
              }}
            >
              Show all
            </FooterAction>
            <FooterAction
              disabled={shown.length <= 1}
              onClick={() => {
                const first = shown.at(0);
                if (!first) return;
                setColumns({
                  visibility: Object.fromEntries(
                    columns.map((column) => [column.id, column.id === first.id]),
                  ),
                });
                announce(`Only ${first.label} shown.`);
              }}
            >
              Hide all but first
            </FooterAction>
            <FooterAction
              disabled={!customised}
              onClick={() => {
                resetColumns();
                setActiveId(null);
                announce("Columns reset to the default set and order.");
              }}
            >
              Reset to default
            </FooterAction>
            <span className="ml-auto text-3xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{shown.length}</span>
              /{columns.length} shown
            </span>
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {announcement}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RowGroup({
  label,
  count,
  hint,
  children,
}: {
  label: string;
  count: string;
  hint: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-7 shrink-0 items-center gap-1.5 bg-popover px-3 pt-1">
        <span
          id={labelId}
          className="text-3xs font-medium tracking-wider text-muted-foreground uppercase"
        >
          {label}
        </span>
        <span className="text-3xs text-muted-foreground/80 tabular-nums">{count}</span>
        <span aria-hidden="true" className="ml-auto text-3xs text-muted-foreground/80">
          {hint}
        </span>
      </div>
      {children}
    </div>
  );
}

function FooterAction({
  disabled = false,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-6 shrink-0 rounded-sm px-1.5 text-2xs font-medium text-foreground/80 outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** The label with the first match of the search emphasised. */
function Highlight({ text, needle }: { text: string; needle: string }) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-xs bg-primary/15 font-semibold text-foreground">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}
