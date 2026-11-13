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
  ListFilter,
  SearchX,
  SlidersHorizontal,
  Star,
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
  RefreshHairline,
} from "./facet-value-list";
import { displayFacetValue, navigationTarget } from "./facet-values";

export type FacetGroup = "active" | "favorite" | "other";

type MenuFocus = "left" | "right";

/**
 * `snapshotGroups` runs on every opening: while open a facet that was active
 * keeps its row, so a pick never moves it.
 */
export function useFiltersMenuState(
  menuFields: readonly string[],
  defaultField: string | null,
  snapshotGroups: () => Map<string, FacetGroup>,
) {
  const [open, setOpenState] = useState(false);
  const [field, setField] = useState<string | null>(null);
  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const [groups, setGroups] = useState<Map<string, FacetGroup> | null>(null);
  const focusRef = useRef<MenuFocus>("left");

  const shownField =
    field !== null && menuFields.includes(field) ? field : defaultField;

  const close = () => {
    setGroups(null);
    setField(null);
    setLeftQuery("");
    setRightQuery("");
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
    groupAtOpen: (target: string) => groups?.get(target),
    shownField,
    setField,
    leftQuery,
    setLeftQuery,
    rightQuery,
    setRightQuery,
    focusTarget: () => focusRef.current,
    setFocusTarget: (target: MenuFocus) => {
      focusRef.current = target;
    },
    openAt: (target: string) => {
      const snapshot = snapshotGroups();
      setGroups(snapshot);
      setField(target);
      setLeftQuery("");
      setRightQuery("");
      focusRef.current = "right";
      setOpenState(true);
    },
  };
}

export type FiltersMenuState = ReturnType<typeof useFiltersMenuState>;

type LeftRow =
  | { kind: "facet"; key: string; field: string; group: FacetGroup }
  | { kind: "value"; key: string; field: string; value: string; count?: number };

const maxValueRowsPerFacet = 5;
const maxValueRows = 24;

interface FiltersMenuProps {
  menu: FiltersMenuState;
  menuFields: readonly string[];
  groupOf: (field: string) => FacetGroup;
  viewOf: (field: string) => FacetView;
  isDefined: (field: string) => boolean;
  labelFor: (field: string) => string;
  filters: Readonly<Partial<Record<string, readonly string[]>>>;
  favoriteFields: ReadonlySet<string>;
  onToggleFavorite: (field: string) => void;
  refreshing: boolean;
  activeCount: number;
  toggleValue: (field: string, value: string) => void;
  setFieldValues: (field: string, values: string[]) => void;
  facetsError?: string;
  facetsUnavailable: boolean;
  onPrefetchFacets: () => void;
}

export function FiltersMenu({
  menu,
  menuFields,
  groupOf,
  viewOf,
  isDefined,
  labelFor,
  filters,
  favoriteFields,
  onToggleFavorite,
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

  // The popup mounts a frame after the open state flips.
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

  const buildRows = (query: string): LeftRow[] => {
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
    const facetRows: LeftRow[] = [
      ...inGroup("active"),
      ...inGroup("favorite"),
      ...inGroup("other"),
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

  const rows = buildRows(menu.leftQuery);
  const shownField = menu.shownField;
  const keyedIndex = rows.findIndex((row) => row.key === activeKey);
  const activeIndex = Math.max(
    0,
    keyedIndex >= 0
      ? keyedIndex
      : rows.findIndex((row) => row.kind === "facet" && row.field === shownField),
  );
  const optionId = (index: number) => `${listId}-${String(index)}`;

  const preview = (row: LeftRow, queryArg?: string) => {
    const query = queryArg ?? menu.leftQuery;
    setActiveKey(row.key);
    menu.setField(row.field);
    menu.setRightQuery(row.kind === "value" ? query.trim() : "");
  };

  const openFacet = (row: Extract<LeftRow, { kind: "facet" }>) => {
    setActiveKey(row.key);
    menu.setField(row.field);
    menu.setRightQuery("");
  };

  // A star moves the row between groups at once; keep it in view.
  const toggleFavorite = (field: string) => {
    onToggleFavorite(field);
    requestAnimationFrame(() => {
      leftListRef.current
        ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(`f:${field}`)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const focusRight = () => {
    menu.setFocusTarget("right");
    rightInputRef.current?.focus();
  };
  /**
   * The checklist is keyed by field, so opening a facet the pane is not showing
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
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (row.kind === "value") toggleRowValue(row);
      else openFacetAndFocus(row);
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
  const favoriteRows = facetRowsIn("favorite");
  const otherRows = facetRowsIn("other");
  const valueRows = rows.filter((row) => row.kind === "value");
  const searching = menu.leftQuery.trim().length > 0;
  const shownView = shownField ? viewOf(shownField) : null;

  const renderRow = (row: LeftRow) => {
    const index = rows.indexOf(row);
    const isActive = index === activeIndex && activeKey !== null;
    const common = {
      id: optionId(index),
      "data-key": row.key,
      "data-active": isActive || undefined,
      onMouseDown: (event: { preventDefault: () => void }) => {
        event.preventDefault();
      },
      onMouseMove: (event: { clientX: number; clientY: number }) => {
        // WebKit fires mousemove on rows scrolling under a still pointer; only
        // a real move previews.
        const last = lastPointer.current;
        lastPointer.current = { x: event.clientX, y: event.clientY };
        if (last?.x === event.clientX && last.y === event.clientY) return;
        if (activeKey === row.key && row.field === shownField) return;
        preview(row);
      },
    };
    if (row.kind === "facet") {
      const applied = filters[row.field] ?? [];
      const favorite = favoriteFields.has(row.field);
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
          aria-label={favorite ? `${rowLabel}, favorite` : rowLabel}
          data-current={current || undefined}
          onClick={() => {
            openFacet(row);
          }}
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
            <span
              aria-hidden="true"
              title={
                favorite
                  ? "Favorite: its counts load up front. Click to remove."
                  : "Add to favorites"
              }
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(row.field);
              }}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 group-data-active/row:opacity-100 group-data-current/row:opacity-100 hover:bg-foreground/5",
                favorite
                  ? "text-primary dark:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Star className={cn("size-3", favorite && "fill-current")} />
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

  const shownFavorite = shownView
    ? favoriteFields.has(shownView.field)
    : false;
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
        {"Filters "}
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
                const first = buildRows(query).at(0);
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
                    label="Favorites"
                    count={favoriteRows.length}
                    bare={
                      activeRows.length === 0 &&
                      otherRows.length === 0 &&
                      valueRows.length === 0
                    }
                  >
                    {favoriteRows.map(renderRow)}
                  </RowGroup>
                  <RowGroup
                    label="Other facets"
                    count={otherRows.length}
                    bare={
                      activeRows.length === 0 &&
                      favoriteRows.length === 0 &&
                      valueRows.length === 0
                    }
                  >
                    {otherRows.map(renderRow)}
                  </RowGroup>
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
                    <button
                      type="button"
                      aria-pressed={shownFavorite}
                      title={
                        shownFavorite
                          ? "In your favorites: its counts load up front. Click to remove."
                          : "Add to favorites"
                      }
                      onClick={() => {
                        menu.setField(shownView.field);
                        toggleFavorite(shownView.field);
                      }}
                      className={cn(
                        "inline-flex h-6 w-22 items-center justify-center gap-1 rounded-md px-1.5 text-2xs font-medium outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
                        shownFavorite
                          ? "text-primary dark:text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Star
                        aria-hidden="true"
                        className={cn("size-3", shownFavorite && "fill-current")}
                      />
                      {shownFavorite ? "Favorited" : "Favorite"}
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
