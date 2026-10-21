"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  ListFilter,
  Pin,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FacetView } from "./active-filter-pill";
import {
  CheckMark,
  EmptyState,
  FacetValueList,
  MenuSearch,
  navigationTarget,
  RefreshHairline,
} from "./facet-value-list";
import { displayFacetValue } from "./facet-values";
import type { FacetActions } from "./use-facet-actions";

/** Where a facet sits in the menu's left pane. */
export type FacetGroup = "active" | "pinned" | "more";

type MenuFocus = "left" | "right";

/**
 * The Filters menu's state, owned by the toolbar so "+N" can open it on a
 * facet. `snapshotGroups` runs on every opening: while the menu is open each
 * facet keeps the group it opened in, so a pick, pin or peek never makes the
 * rows jump.
 */
export function useFiltersMenuState(
  menuFields: readonly string[],
  /** Shown on the right when nothing else is (first active, else pinned). */
  defaultField: string | null,
  snapshotGroups: () => Map<string, FacetGroup>,
) {
  const [open, setOpenState] = useState(false);
  const [field, setField] = useState<string | null>(null);
  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [groups, setGroups] = useState<Map<string, FacetGroup> | null>(null);
  const focusRef = useRef<MenuFocus>("left");

  const shownField =
    field !== null && menuFields.includes(field) ? field : defaultField;

  const close = () => {
    setGroups(null);
    // A peeked facet leaves the counted set on close; reopening on it would
    // show a checklist with no counts coming.
    setField(null);
    setLeftQuery("");
    setRightQuery("");
    setMoreOpen(false);
    setOpenState(false);
  };

  return {
    open,
    setOpen: (next: boolean) => {
      if (!next) {
        close();
        return;
      }
      setGroups(snapshotGroups());
      setOpenState(true);
    },
    /** The group a facet opened in, while the menu is open. */
    groupAtOpen: (target: string) => groups?.get(target),
    shownField,
    setField,
    leftQuery,
    setLeftQuery,
    rightQuery,
    setRightQuery,
    moreOpen,
    setMoreOpen,
    /** Which search box the menu focuses when it opens. */
    focusTarget: () => focusRef.current,
    setFocusTarget: (target: MenuFocus) => {
      focusRef.current = target;
    },
    /** Open on a given facet with its checklist focused ("+N"). */
    openAt: (target: string) => {
      const snapshot = snapshotGroups();
      setGroups(snapshot);
      setField(target);
      setLeftQuery("");
      setRightQuery("");
      setMoreOpen(snapshot.get(target) === "more");
      focusRef.current = "right";
      setOpenState(true);
    },
  };
}

export type FiltersMenuState = ReturnType<typeof useFiltersMenuState>;

type LeftRow =
  | { kind: "facet"; key: string; field: string; group: FacetGroup }
  /** The folded More group's header: a row of its own in the key order. */
  | { kind: "more"; key: string; count: number }
  | { kind: "value"; key: string; field: string; value: string; count?: number };

const maxValueRowsPerFacet = 5;
const maxValueRows = 24;
const moreRowKey = "more";

interface FiltersMenuProps {
  menu: FiltersMenuState;
  menuFields: readonly string[];
  groupOf: (field: string) => FacetGroup;
  viewOf: (field: string) => FacetView;
  isDefined: (field: string) => boolean;
  labelFor: (field: string) => string;
  filters: Readonly<Partial<Record<string, readonly string[]>>>;
  facetActions: FacetActions;
  /** Counts refreshing for this scope: the menu's one busy signal. */
  refreshing: boolean;
  activeCount: number;
  toggleValue: (field: string, value: string) => void;
  setFieldValues: (field: string, values: string[]) => void;
  facetsError?: string;
  facetsUnavailable: boolean;
  onPrefetchFacets: () => void;
}

/**
 * The toolbar's Filters button and its two-pane menu. Left: the facets,
 * grouped Active · Facets (the pinned set) · a folded MORE group whose
 * counts all load together when it is unfolded, plus values matching the
 * search. Right: the current facet's checklist. Hovering or arrowing switches
 * the right pane at once to any counted facet; hovering never starts a read.
 */
export function FiltersMenu({
  menu,
  menuFields,
  groupOf,
  viewOf,
  isDefined,
  labelFor,
  filters,
  facetActions,
  refreshing,
  activeCount,
  toggleValue,
  setFieldValues,
  facetsError,
  facetsUnavailable,
  onPrefetchFacets,
}: FiltersMenuProps) {
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  const leftListRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // Opened on a facet far down the list ("+N"): bring it into view once per
  // opening. The popup mounts a frame after the open state flips.
  const openedOn = menu.open ? menu.shownField : null;
  const scrolledToOpened = useRef(false);
  useEffect(() => {
    if (openedOn === null) {
      scrolledToOpened.current = false;
      return;
    }
    if (scrolledToOpened.current) return;
    scrolledToOpened.current = true;
    const frame = requestAnimationFrame(() => {
      leftListRef.current
        ?.querySelector<HTMLElement>(
          `[data-key="${CSS.escape(`f:${openedOn}`)}"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [openedOn]);

  // Rows in key order: Active, the pinned facets, then More (its header row,
  // and its facets when unfolded; a search always unfolds it), then values.
  const buildRows = (query: string, moreOpen: boolean): LeftRow[] => {
    const needle = query.trim().toLowerCase();
    const matched = menuFields.filter(
      (field) => !needle || labelFor(field).toLowerCase().includes(needle),
    );
    const facetRow = (field: string): LeftRow => ({
      kind: "facet",
      key: `f:${field}`,
      field,
      group: groupOf(field),
    });
    const inGroup = (group: FacetGroup) =>
      matched.filter((field) => groupOf(field) === group).map(facetRow);
    const more = inGroup("more");
    const facetRows: LeftRow[] = [
      ...inGroup("active"),
      ...inGroup("pinned"),
      ...(more.length > 0 && !needle
        ? [{ kind: "more" as const, key: moreRowKey, count: more.length }]
        : []),
      ...(needle || moreOpen ? more : []),
    ];
    if (needle.length < 2) return facetRows;
    const valueRows: LeftRow[] = [];
    for (const field of menuFields) {
      const matches = viewOf(field)
        .options.filter((option) =>
          displayFacetValue(option.value).toLowerCase().includes(needle),
        )
        .slice(0, maxValueRowsPerFacet);
      for (const option of matches) {
        if (valueRows.length >= maxValueRows) break;
        valueRows.push({
          kind: "value",
          key: `v:${field}:${option.value}`,
          field,
          value: option.value,
          count: option.count,
        });
      }
    }
    return [...facetRows, ...valueRows];
  };

  const rows = buildRows(menu.leftQuery, menu.moreOpen);
  const shownField = menu.shownField;
  const keyedIndex = rows.findIndex((row) => row.key === activeKey);
  const activeIndex = Math.max(
    0,
    keyedIndex >= 0
      ? keyedIndex
      : rows.findIndex((row) => row.kind === "facet" && row.field === shownField),
  );
  const optionId = (index: number) => `${listId}-${String(index)}`;

  /** Count every More facet, in one read, before one of them is shown. */
  const countMoreFacets = () => {
    facetActions.peek(menuFields.filter((field) => groupOf(field) === "more"));
  };

  /**
   * Make a row the highlighted one and show its facet on the right. A More
   * facet not yet counted (a search lists it while More is folded) is only
   * highlighted: hovering or arrowing never starts a read.
   */
  const preview = (row: LeftRow, query = menu.leftQuery) => {
    setActiveKey(row.key);
    if (row.kind === "more" || !facetActions.isCounted(row.field)) return;
    menu.setField(row.field);
    menu.setRightQuery(row.kind === "value" ? query.trim() : "");
  };

  /** A click, Enter or → on a facet: show it, counting More first if needed. */
  const openFacet = (row: Extract<LeftRow, { kind: "facet" }>) => {
    setActiveKey(row.key);
    if (!facetActions.isCounted(row.field)) countMoreFacets();
    menu.setField(row.field);
    menu.setRightQuery("");
  };

  const toggleMore = () => {
    const opening = !menu.moreOpen;
    flushSync(() => {
      menu.setMoreOpen(opening);
      setActiveKey(moreRowKey);
    });
    if (!opening) return;
    countMoreFacets();
    // Bring the header to the top so the facets it just revealed are in view.
    const list = leftListRef.current;
    const header = list?.querySelector<HTMLElement>("[data-more-header]");
    if (!list || !header) return;
    list.scrollTo({
      top: header.offsetTop,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  const focusRight = () => {
    menu.setFocusTarget("right");
    rightInputRef.current?.focus();
  };
  /**
   * Enter or → on a facet. The checklist is keyed by its field, so opening a
   * facet the pane is not showing (an uncounted one is only highlighted)
   * replaces it: commit that first, then focus the new one.
   */
  const openFacetAndFocus = (row: Extract<LeftRow, { kind: "facet" }>) => {
    flushSync(() => {
      openFacet(row);
    });
    focusRight();
  };
  const focusLeft = () => {
    menu.setFocusTarget("left");
    leftInputRef.current?.focus();
  };

  const toggleRowValue = (row: Extract<LeftRow, { kind: "value" }>) => {
    menu.setField(row.field);
    toggleValue(row.field, row.value);
  };

  const onLeftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) return;
    const target = navigationTarget(event.key, activeIndex, rows.length);
    const row = rows[activeIndex];
    if (target !== undefined) {
      event.preventDefault();
      const next = rows[target];
      preview(next);
      leftListRef.current
        ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (
      row.kind === "more" &&
      (event.key === "Enter" ||
        (event.key === " " && event.currentTarget.value === ""))
    ) {
      // Space types into a non-empty search; on the header it folds.
      event.preventDefault();
      toggleMore();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (row.kind === "value") toggleRowValue(row);
      else if (row.kind === "facet") openFacetAndFocus(row);
    } else if (
      event.key === "ArrowRight" &&
      row.kind === "facet" &&
      event.currentTarget.selectionStart === event.currentTarget.value.length
    ) {
      event.preventDefault();
      openFacetAndFocus(row);
    }
  };

  const onRightKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    if (
      (event.key === "ArrowLeft" && atStart) ||
      (event.key === "Backspace" && input.value === "")
    ) {
      event.preventDefault();
      focusLeft();
    }
  };

  const facetRowsIn = (group: FacetGroup) =>
    rows.filter((row) => row.kind === "facet" && row.group === group);
  const activeRows = facetRowsIn("active");
  const pinnedRows = facetRowsIn("pinned");
  const moreRows = facetRowsIn("more");
  const moreHeader = rows.find((row) => row.kind === "more");
  const valueRows = rows.filter((row) => row.kind === "value");
  const searching = menu.leftQuery.trim().length > 0;
  const shownView = shownField ? viewOf(shownField) : null;

  const renderRow = (row: LeftRow) => {
    const index = rows.indexOf(row);
    // The tint follows the pointer or the arrows only; the current facet is
    // marked by its bar, not by a second fill.
    const isActive = index === activeIndex && activeKey !== null;
    const common = {
      id: optionId(index),
      "data-key": row.key,
      "data-active": isActive || undefined,
      onMouseDown: (event: { preventDefault: () => void }) => {
        event.preventDefault();
      },
      onMouseMove: (event: { clientX: number; clientY: number }) => {
        // WebKit fires mousemove on rows scrolling under a still pointer
        // (unfolding More scrolls the list); only a real move previews, so
        // the pane never jumps to a facet the user never pointed at.
        const last = lastPointer.current;
        lastPointer.current = { x: event.clientX, y: event.clientY };
        if (last?.x === event.clientX && last.y === event.clientY) return;
        if (
          activeKey === row.key &&
          (row.kind === "more" || row.field === shownField)
        ) {
          return;
        }
        preview(row);
      },
    };
    if (row.kind === "more") {
      const Chevron = menu.moreOpen ? ChevronUp : ChevronDown;
      return (
        <div
          key={row.key}
          {...common}
          role="option"
          aria-selected={false}
          aria-label={`${menu.moreOpen ? "Hide" : "Show"} ${String(row.count)} more ${row.count === 1 ? "facet" : "facets"}`}
          onClick={toggleMore}
          className="group/row mx-1.5 flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-3xs font-medium tracking-wider text-muted-foreground uppercase data-active:bg-foreground/5 data-active:text-foreground"
        >
          <span>More</span>
          <span className="tabular-nums opacity-70">{row.count}</span>
          <span className="ml-auto flex items-center gap-0.5 text-2xs font-medium tracking-normal text-foreground normal-case">
            {menu.moreOpen ? "Show less" : "Show all"}
            <Chevron
              aria-hidden="true"
              className="size-3 shrink-0 text-muted-foreground"
            />
          </span>
        </div>
      );
    }
    if (row.kind === "facet") {
      const applied = filters[row.field] ?? [];
      const pinned = facetActions.isPinned(row.field);
      const current = row.field === shownField;
      const appliedValues = applied.map(displayFacetValue);
      const rowLabel =
        applied.length > 0
          ? `${labelFor(row.field)}: ${appliedValues.join(", ")}`
          : labelFor(row.field);
      return (
        <div
          key={row.key}
          {...common}
          role="option"
          aria-selected={current}
          aria-label={pinned ? `${rowLabel}, pinned` : rowLabel}
          data-current={current || undefined}
          onClick={() => {
            openFacet(row);
          }}
          // One height for every row (applied values sit inline), so a pick
          // never pushes the rows below it.
          className="group/row relative mx-1.5 flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md pr-1 pl-2.5 text-xs text-muted-foreground data-active:bg-foreground/5 data-active:text-foreground data-current:font-medium data-current:text-foreground"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary opacity-0 group-data-current/row:opacity-100"
          />
          <span className="min-w-0 flex-1 truncate">
            {labelFor(row.field)}
            {applied.length > 0 && (
              <span className="ml-1.5 text-2xs font-normal text-primary dark:text-foreground">
                {appliedValues.join(", ")}
              </span>
            )}
          </span>
          {isDefined(row.field) ? (
            // A mouse shortcut; the keyboard path is the Pin button in the
            // right pane's header. Shown on the hovered and current rows.
            <span
              aria-hidden="true"
              title={
                pinned
                  ? "Pinned: in your facet set. Click to unpin."
                  : "Pin to keep this facet in your set"
              }
              onClick={(event) => {
                event.stopPropagation();
                facetActions.togglePin(row.field);
              }}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 group-data-active/row:opacity-100 group-data-current/row:opacity-100 hover:bg-foreground/5",
                pinned
                  ? "text-primary dark:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Pin className={cn("size-3", pinned && "fill-current")} />
            </span>
          ) : (
            <span aria-hidden="true" className="size-5 shrink-0" />
          )}
        </div>
      );
    }
    const selected = (filters[row.field] ?? []).includes(row.value);
    return (
      <div
        key={row.key}
        {...common}
        role="option"
        aria-selected={selected}
        aria-label={`${labelFor(row.field)}: ${displayFacetValue(row.value)}`}
        onClick={() => {
          toggleRowValue(row);
        }}
        className="group/option mx-1.5 flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-md pr-2.5 pl-2 text-xs text-foreground data-active:bg-foreground/5"
      >
        <CheckMark checked={selected} />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={cn("truncate", selected && "font-medium")}>
            {displayFacetValue(row.value)}
          </span>
          <span className="truncate text-3xs text-muted-foreground">
            {labelFor(row.field)}
          </span>
        </span>
        <span className="w-14 shrink-0 text-right text-2xs text-muted-foreground tabular-nums">
          {row.count?.toLocaleString()}
        </span>
      </div>
    );
  };

  const shownPinned = shownView ? facetActions.isPinned(shownView.field) : false;
  // Counts refreshing after a pick, or a peeked facet's first counts.
  const busy =
    refreshing ||
    (shownView !== null &&
      !shownView.notCounted &&
      shownView.status === "loading");

  return (
    <Popover
      open={menu.open}
      onOpenChange={menu.setOpen}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={
              activeCount > 0 ? `Filters, ${String(activeCount)} active` : "Filters"
            }
            onClick={() => {
              menu.setFocusTarget("left");
            }}
            onPointerEnter={onPrefetchFacets}
            onFocus={onPrefetchFacets}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background pr-1.5 pl-2 text-xs font-medium text-foreground shadow-xs outline-none hover:bg-foreground/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-foreground/5"
          />
        }
      >
        <ListFilter aria-hidden="true" className="size-3.5" />
        Filters
        {activeCount > 0 ? (
          <span className="min-w-3.5 border-l border-border pl-1.5 text-center text-2xs font-semibold text-primary tabular-nums dark:text-foreground">
            {activeCount}
          </span>
        ) : (
          <ChevronDown aria-hidden="true" className="size-3 opacity-60" />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        size="flush"
        variant="raised"
        className="@container w-150 overflow-hidden"
        initialFocus={() =>
          menu.focusTarget() === "right"
            ? rightInputRef.current
            : leftInputRef.current
        }
      >
        {/* Two panes side by side; in a popup narrower than @lg (a phone)
            the facets sit above the values instead. */}
        <div className="relative flex h-120 max-h-(--available-height) flex-col @lg:h-90 @lg:flex-row">
          <RefreshHairline active={busy} />
          <div className="flex h-44 shrink-0 flex-col border-b border-border @lg:h-auto @lg:w-56 @lg:border-r @lg:border-b-0">
            <MenuSearch
              inputRef={leftInputRef}
              label="Find a facet or value"
              listId={listId}
              activeId={rows.length > 0 ? optionId(activeIndex) : undefined}
              value={menu.leftQuery}
              placeholder="Facet or value…"
              onFocus={() => {
                menu.setFocusTarget("left");
              }}
              onChange={(query) => {
                menu.setLeftQuery(query);
                // Land on the first match: a facet whose label matches, else
                // a value ("germany" shows Isolation Country › Germany on the
                // right, its search seeded).
                const first = buildRows(query, menu.moreOpen).at(0);
                if (first) preview(first, query);
                else setActiveKey(null);
              }}
              onKeyDown={onLeftKeyDown}
            />
            <div
              ref={leftListRef}
              id={listId}
              role="listbox"
              aria-label="Facets"
              onMouseLeave={() => {
                setActiveKey(null);
              }}
              className="relative no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-1.5"
            >
              {rows.length === 0 ? (
                <EmptyState
                  icon={searching ? SearchX : SlidersHorizontal}
                  title={
                    searching
                      ? `Nothing matches “${menu.leftQuery.trim()}”`
                      : "No facets"
                  }
                  detail={
                    searching
                      ? "Searched every facet's name and the values in loaded counts."
                      : "This table offers no facets."
                  }
                />
              ) : (
                <>
                  <RowGroup label="Active" count={activeRows.length}>
                    {activeRows.map(renderRow)}
                  </RowGroup>
                  <RowGroup
                    label="Facets"
                    count={pinnedRows.length}
                    // A lone facet list needs no heading.
                    bare={
                      activeRows.length === 0 &&
                      moreRows.length === 0 &&
                      moreHeader === undefined &&
                      valueRows.length === 0
                    }
                  >
                    {pinnedRows.map(renderRow)}
                  </RowGroup>
                  {moreHeader ? (
                    <>
                      {/* Sticky, so "Show less" stays in reach. It sticks
                          above the list's top padding (6px) and its own
                          border (1px), so no row shows through above it and
                          its border tucks under the search row's divider. */}
                      <div
                        data-more-header
                        className="sticky -top-1.75 z-10 mt-1.5 shrink-0 border-t border-border bg-popover py-1 first:mt-0 first:border-t-0"
                      >
                        {renderRow(moreHeader)}
                      </div>
                      {moreRows.length > 0 && (
                        <div
                          role="group"
                          aria-label="More facets"
                          className="flex shrink-0 flex-col"
                        >
                          {moreRows.map(renderRow)}
                        </div>
                      )}
                    </>
                  ) : (
                    <RowGroup label="More" count={moreRows.length}>
                      {moreRows.map(renderRow)}
                    </RowGroup>
                  )}
                  <RowGroup
                    label="Values in loaded counts"
                    count={valueRows.length}
                  >
                    {valueRows.map(renderRow)}
                  </RowGroup>
                </>
              )}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {shownView ? (
              <FacetValueList
                key={shownView.field}
                fill
                label={shownView.label}
                options={shownView.options}
                status={shownView.status}
                isSelected={(value) => shownView.values.includes(value)}
                selectedCount={shownView.values.length}
                onToggle={(value) => {
                  toggleValue(shownView.field, value);
                }}
                onClear={() => {
                  setFieldValues(shownView.field, []);
                }}
                error={facetsError}
                unavailable={facetsUnavailable}
                notCounted={shownView.notCounted}
                inputRef={rightInputRef}
                query={menu.rightQuery}
                onQueryChange={menu.setRightQuery}
                onSearchKeyDown={onRightKeyDown}
                onSearchFocus={() => {
                  menu.setFocusTarget("right");
                }}
                headerAction={
                  isDefined(shownView.field) ? (
                    // Fixed width for "Pinned", so the toggle never moves Clear.
                    <button
                      type="button"
                      aria-pressed={shownPinned}
                      title={
                        shownPinned
                          ? "In your facet set: its counts load up front. Click to unpin."
                          : "Keep this facet in your set"
                      }
                      onClick={() => {
                        // Hold the pane here even if it was only the default.
                        menu.setField(shownView.field);
                        facetActions.togglePin(shownView.field);
                      }}
                      className={cn(
                        "inline-flex h-6 w-18 items-center justify-center gap-1 rounded-md px-1.5 text-2xs font-medium outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
                        shownPinned
                          ? "text-primary dark:text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Pin
                        aria-hidden="true"
                        className={cn("size-3", shownPinned && "fill-current")}
                      />
                      {shownPinned ? "Pinned" : "Pin"}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
                <SlidersHorizontal
                  aria-hidden="true"
                  className="size-5 opacity-50"
                />
                Pick a facet on the left to see its values.
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A labelled run of options in the facet list; nothing when it is empty. */
function RowGroup({
  label,
  count,
  bare = false,
  children,
}: {
  label: string;
  count: number;
  bare?: boolean;
  children: ReactNode;
}) {
  const labelId = useId();
  if (count === 0) return null;
  if (bare) return <>{children}</>;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="mt-1.5 flex shrink-0 flex-col border-t border-border pt-1.5 first:mt-0 first:border-t-0 first:pt-0"
    >
      <div className="flex h-6 shrink-0 items-center gap-1.5 px-4">
        <span
          id={labelId}
          className="text-3xs font-medium tracking-wider text-muted-foreground uppercase"
        >
          {label}
        </span>
        <span
          aria-hidden="true"
          className="text-3xs text-muted-foreground/70 tabular-nums"
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}
