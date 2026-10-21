"use client";

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, Inbox, Search, SearchX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { displayFacetValue, type FacetValueOption } from "./facet-values";
import type { FacetStatus } from "./types";

/**
 * The index ↑/↓/Page Up/Page Down moves a list's highlight to from `index`,
 * kept inside the list's `count` rows; `undefined` for any other key.
 */
export function navigationTarget(
  key: string,
  index: number,
  count: number,
): number | undefined {
  const steps: Partial<Record<string, number>> = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: 8,
    PageUp: -8,
  };
  const step = steps[key];
  if (step === undefined) return undefined;
  return Math.max(0, Math.min(count - 1, index + step));
}

/**
 * Keyboard model of the menus' lists: focus stays in the search box, the
 * arrows move a highlighted option (`aria-activedescendant`), Enter picks it.
 */
export function useOptionNavigation(
  count: number,
  onPick: (index: number) => void,
  listRef: RefObject<HTMLDivElement | null>,
) {
  const [active, setActive] = useState(0);
  const current = count === 0 ? -1 : Math.min(active, count - 1);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (count === 0) return;
    const target = navigationTarget(event.key, current, count);
    if (target !== undefined) {
      event.preventDefault();
      setActive(target);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${String(target)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && current >= 0) {
      event.preventDefault();
      onPick(current);
    }
  };

  return {
    active: current,
    setActive,
    onKeyDown,
    reset: () => {
      setActive(0);
    },
  };
}

/** The square a selected option fills with the primary color. */
export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-xs border transition-colors duration-100 motion-reduce:transition-none",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50 bg-transparent group-hover/option:border-foreground/70 group-data-active/option:border-foreground/70",
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

/** A count's share of the largest one, as a 2px bar. */
function CountBar({ share, selected }: { share: number; selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-0.5 w-10 shrink-0 overflow-hidden rounded-full bg-foreground/5"
    >
      <span
        style={
          {
            "--facet-share": `${String(Math.max(share * 100, share > 0 ? 4 : 0))}%`,
          } as CSSProperties
        }
        className={cn(
          "absolute inset-y-0 left-0 w-(--facet-share) rounded-full",
          selected ? "bg-primary" : "bg-primary/35 dark:bg-foreground/25",
        )}
      />
    </span>
  );
}

/**
 * A menu's one "counts are refreshing" signal: a 2px primary line along its
 * top edge that eases most of the way across while counts load, then
 * completes and fades. Remounted per refresh, so each one starts from zero;
 * nothing else in the menu dims or moves.
 */
export function RefreshHairline({ active }: { active: boolean }) {
  const [cycle, setCycle] = useState(0);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setCycle((value) => value + 1);
  }
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden"
    >
      {cycle > 0 && (
        <span
          key={cycle}
          data-slot="refresh-hairline"
          data-active={active || undefined}
          className={cn(
            "absolute inset-0 origin-left bg-primary motion-reduce:transition-none",
            active
              ? "scale-x-85 transition-transform duration-1500 ease-out starting:scale-x-0"
              : "scale-x-100 opacity-0 transition duration-120 ease-out",
          )}
        />
      )}
    </span>
  );
}

/** A pane's empty or no-match state: a quiet glyph, what happened, what to do. */
export function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1.5 p-6 text-center">
      <span
        aria-hidden="true"
        className="mb-1 flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground"
      >
        <Icon className="size-3.5" />
      </span>
      <p className="max-w-60 text-xs font-medium text-foreground">{title}</p>
      {detail && (
        <p className="max-w-60 text-2xs leading-4 text-muted-foreground">
          {detail}
        </p>
      )}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

/** A search box at the top of a menu pane; it drives the list below it. */
export function MenuSearch({
  inputRef,
  value,
  onChange,
  placeholder,
  label,
  listId,
  activeId,
  onKeyDown,
  onFocus,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  listId: string;
  activeId?: string;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <Search
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

interface FacetValueListProps {
  label: string;
  options: FacetValueOption[];
  status: FacetStatus;
  isSelected: (value: string) => boolean;
  selectedCount: number;
  onToggle: (value: string) => void;
  onClear: () => void;
  /** The counts failed; the toolbar shows the Retry. */
  error?: string;
  /** No counts until the rows load (their alert says why). */
  unavailable?: boolean;
  /** No facet names the field, so nothing counts its values. */
  notCounted?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Controlled query (the Filters menu seeds and keeps it). */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Runs before the list's own keys (the menu's ← back to the facets). */
  onSearchKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSearchFocus?: () => void;
  /** Fill a fixed-height pane instead of capping the list at 20rem. */
  fill?: boolean;
  /** A header button beside Clear (the menu's Pin toggle). */
  headerAction?: ReactNode;
}

/**
 * One facet's value checklist: the body of an active pill's popover and the
 * Filters menu's right pane. Every slot that can appear (the selection count,
 * placeholder rows) is reserved at its final size, so nothing moves as
 * counts land.
 */
export function FacetValueList({
  label,
  options,
  status,
  isSelected,
  selectedCount,
  onToggle,
  onClear,
  error,
  unavailable = false,
  notCounted = false,
  inputRef,
  query: controlledQuery,
  onQueryChange,
  onSearchKeyDown,
  onSearchFocus,
  fill = false,
  headerAction,
}: FacetValueListProps) {
  const [ownQuery, setOwnQuery] = useState("");
  const query = controlledQuery ?? ownQuery;
  const setQuery = onQueryChange ?? setOwnQuery;
  const listId = useId();
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) =>
        displayFacetValue(option.value).toLowerCase().includes(needle),
      )
    : options;
  const listRef = useRef<HTMLDivElement>(null);
  const nav = useOptionNavigation(
    shown.length,
    (index) => {
      onToggle(shown[index].value);
    },
    listRef,
  );
  let maxCount = 1;
  for (const option of options) {
    if ((option.count ?? 0) > maxCount) maxCount = option.count ?? 0;
  }
  const loading = status === "loading" && !notCounted && !unavailable && !error;
  const optionId = (index: number) => `${listId}-${String(index)}`;

  return (
    <div className={cn("flex flex-col", fill && "h-full min-h-0")}>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border pr-1.5 pl-3">
        <span className="truncate text-xs font-semibold text-foreground">
          {label}
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          {headerAction}
          {/* Its count's slot is reserved, so ticking never moves the header. */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onClear}
            aria-label={
              selectedCount > 0
                ? `Clear ${String(selectedCount)} ${label} ${selectedCount === 1 ? "value" : "values"}`
                : `Clear ${label}`
            }
            className="inline-flex h-6 min-w-16 items-center justify-center gap-1 rounded-md px-1.5 text-2xs font-medium text-foreground outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
          >
            Clear
            <span
              className={cn(
                "min-w-3 text-left text-primary tabular-nums dark:text-foreground",
                selectedCount === 0 && "invisible",
              )}
            >
              {selectedCount}
            </span>
          </button>
        </span>
      </div>

      <MenuSearch
        inputRef={inputRef}
        value={query}
        onChange={(value) => {
          setQuery(value);
          nav.reset();
        }}
        placeholder={`Filter ${label.toLowerCase()}…`}
        label={`Filter ${label} values`}
        listId={listId}
        activeId={nav.active >= 0 ? optionId(nav.active) : undefined}
        onKeyDown={(event) => {
          onSearchKeyDown?.(event);
          if (!event.defaultPrevented) nav.onKeyDown(event);
        }}
        onFocus={onSearchFocus}
      />

      {error && (
        <p
          role="alert"
          className="shrink-0 border-b border-border bg-destructive/10 px-3 py-1.5 text-2xs text-destructive"
        >
          Could not load filter values: {error}
        </p>
      )}
      {unavailable && (
        <p className="shrink-0 border-b border-border px-3 py-1.5 text-2xs text-muted-foreground">
          Filter values are unavailable until the results load.
        </p>
      )}
      {notCounted && (
        <p className="shrink-0 border-b border-border px-3 py-1.5 text-2xs text-muted-foreground">
          This filter has no facet, so its values are not counted.
        </p>
      )}

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={`${label} values`}
        aria-multiselectable="true"
        aria-busy={loading || status === "stale" || undefined}
        className={cn(
          "overflow-y-auto overscroll-contain py-1",
          fill ? "min-h-0 flex-1" : "max-h-80",
        )}
      >
        {loading && shown.length === 0 && <ValueListSkeleton />}
        {!loading && shown.length === 0 && (
          <EmptyState
            icon={needle ? SearchX : Inbox}
            {...emptyValuesMessage({
              label,
              query: query.trim(),
              listed: options.length,
              unavailable,
              notCounted,
            })}
            action={
              needle ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    setQuery("");
                    nav.reset();
                    inputRef.current?.focus();
                  }}
                >
                  Clear search
                </Button>
              ) : undefined
            }
          />
        )}
        {shown.map((option, index) => {
          const selected = isSelected(option.value);
          const share =
            option.count === undefined ? 0 : option.count / maxCount;
          return (
            <div
              key={option.value}
              id={optionId(index)}
              data-index={index}
              role="option"
              aria-selected={selected}
              data-active={index === nav.active || undefined}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onMouseMove={() => {
                if (index !== nav.active) nav.setActive(index);
              }}
              onClick={() => {
                onToggle(option.value);
              }}
              className="group/option mx-1.5 flex h-7 shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 text-xs text-foreground data-active:bg-foreground/5"
            >
              <CheckMark checked={selected} />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  option.value === "" && "text-muted-foreground italic",
                  selected && "font-medium",
                )}
                title={displayFacetValue(option.value)}
              >
                {displayFacetValue(option.value)}
              </span>
              <CountBar share={share} selected={selected} />
              <span
                className={cn(
                  "w-14 shrink-0 text-right text-2xs tabular-nums",
                  selected ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {option.count === undefined
                  ? "—"
                  : option.count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-border px-3 text-3xs text-muted-foreground">
        <span className="tabular-nums">
          {valueSummary(loading, needle !== "", shown.length, options.length)}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-xs border border-border px-1 font-sans">
            ↑↓
          </kbd>
          <kbd className="rounded-xs border border-border px-1 font-sans">
            ↵
          </kbd>
          <span>select · any of</span>
        </span>
      </div>
    </div>
  );
}

/** What an empty checklist says: no match for the search, or no values. */
function emptyValuesMessage({
  label,
  query,
  listed,
  unavailable,
  notCounted,
}: {
  label: string;
  query: string;
  listed: number;
  unavailable: boolean;
  notCounted: boolean;
}): { title: string; detail: string } {
  if (query) {
    return {
      title: `No ${label.toLowerCase()} matches “${query}”`,
      detail: `${listed.toLocaleString()} ${listed === 1 ? "value is" : "values are"} listed; try fewer letters.`,
    };
  }
  // Nothing counts the field, so whether any record has it is unknown.
  if (notCounted) {
    return {
      title: "No values picked",
      detail: "Without a facet, only picked values are listed.",
    };
  }
  if (unavailable) {
    return {
      title: "No values yet",
      detail: "Values appear once the results load.",
    };
  }
  return {
    title: "No values in these results",
    detail: "None of the matching records has this field set.",
  };
}

/** The checklist footer's count: "Loading values…", "3 of 40 values", … */
function valueSummary(
  loading: boolean,
  searching: boolean,
  shown: number,
  listed: number,
): string {
  if (loading && listed === 0) return "Loading values…";
  if (searching) {
    return `${shown.toLocaleString()} of ${listed.toLocaleString()} values`;
  }
  return `${listed.toLocaleString()} ${listed === 1 ? "value" : "values"}`;
}

const skeletonWidths = ["w-28", "w-20", "w-24", "w-16", "w-22"] as const;

/** Placeholder rows at the real rows' height and inset. */
function ValueListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {skeletonWidths.map((width) => (
        <div
          key={width}
          data-slot="skeleton"
          className="mx-1.5 flex h-7 items-center gap-2.5 px-2"
        >
          <span className="size-3.5 shrink-0 rounded-xs border border-border" />
          <span
            className={cn(
              "h-2 rounded-full bg-foreground/5 motion-safe:animate-pulse",
              width,
            )}
          />
          <span className="ml-auto h-0.5 w-10 rounded-full bg-foreground/5" />
          <span className="h-2 w-8 rounded-full bg-foreground/5 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
