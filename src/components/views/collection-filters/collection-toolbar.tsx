"use client";

import { useRef, useState } from "react";
import { Braces, CircleAlert, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { QueryRetryButton } from "../query-retry-button";
import {
  ActiveFilterPill,
  MorePillFace,
  PillFace,
  usePillOverflow,
  type FacetView,
} from "./active-filter-pill";
import { ColumnsMenu } from "./columns-menu";
import { facetValueOptions } from "./facet-values";
import {
  FiltersMenu,
  useFiltersMenuState,
  type FacetGroup,
} from "./filters-menu";
import type { CollectionToolbarProps } from "./types";
import { useFacetActions } from "./use-facet-actions";

/**
 * A resource collection's one-row toolbar:
 * keyword · Filters (n) · active filter pills · Clear all · Columns.
 * Filters and every pill open the facets' checklists; nothing above the table
 * grows as filters are added (pills that do not fit go behind "+N").
 */
export function CollectionToolbar(props: CollectionToolbarProps) {
  const {
    keyword,
    onKeywordChange,
    keywordPlaceholder,
    definitions,
    pinnedFields,
    peekedFields,
    facets,
    facetStatus,
    facetsError,
    onRetryFacets,
    facetsRetrying,
    facetsUnavailable,
    onPrefetchFacets,
    filters,
    toggleValue,
    setFieldValues,
    clearAll,
    canClear,
    hasExplicitRql,
    columns,
    setColumns,
    resetColumns,
  } = props;

  const definedFields = definitions.map((definition) => definition.field);
  const isDefined = (field: string) => definedFields.includes(field);
  const labelFor = (field: string) =>
    definitions.find((definition) => definition.field === field)?.label ??
    field;
  const hasFilter = (field: string) => (filters[field]?.length ?? 0) > 0;
  // The pill whose popover is open stays on the row after its last value is
  // unticked, so the popover keeps its anchor.
  const [heldField, setHeldField] = useState<string | null>(null);
  // Every facet the resource offers, then any filtered field no facet names
  // (a link's filter), so every filter is reachable. A held link filter stays
  // too, though unticking its last value drops it from `filters`.
  const linkFields = new Set(
    [...Object.keys(filters).filter(hasFilter), heldField].filter(
      (field): field is string => field !== null && !isDefined(field),
    ),
  );
  const menuFields = [...definedFields, ...linkFields];
  const activeFields = menuFields.filter(hasFilter);

  const rowFields = menuFields.filter(
    (field) => hasFilter(field) || field === heldField,
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const { overflow, measured } = usePillOverflow(trackRef, measureRef);
  const shownPills = rowFields.filter((field) => !overflow.has(field));
  const hiddenPills = rowFields.filter((field) => overflow.has(field));
  const hiddenPillLabels = hiddenPills.map(labelFor).join(", ");

  const liveGroup = (field: string): FacetGroup => {
    if (hasFilter(field)) return "active";
    if (pinnedFields.has(field)) return "pinned";
    return "more";
  };
  const menu = useFiltersMenuState(
    menuFields,
    activeFields.at(0) ??
      definedFields.find((field) => pinnedFields.has(field)) ??
      null,
    () => new Map(menuFields.map((field) => [field, liveGroup(field)])),
  );
  const groupOf = (field: string): FacetGroup =>
    (menu.open ? menu.groupAtOpen(field) : undefined) ?? liveGroup(field);

  const idle = !menu.open && heldField === null;
  const facetActions = useFacetActions(props, idle);

  const viewOf = (field: string): FacetView => {
    const values = filters[field] ?? [];
    return {
      field,
      label: labelFor(field),
      values,
      status: facetStatus(field),
      notCounted: !isDefined(field),
      options: facetValueOptions(facets[field], values),
    };
  };

  // Counts belong to the scope, so any counted facet showing the previous
  // scope's means a refresh is in flight.
  const refreshing = [...pinnedFields, ...peekedFields].some(
    (field) => facetStatus(field) === "stale",
  );
  // Opening a menu counts the pinned facets and the active ones; the More
  // group waits until it is unfolded.
  const countActiveFacets = () => {
    facetActions.peek(activeFields);
  };

  const facetsErrorMessage =
    facetsError && `Could not load filter values: ${facetsError}`;

  // Narrower than @2xl (a phone, or a squeezed panel) the keyword box takes
  // its own row and the rest wraps beneath it, so every control stays
  // reachable; ResourceWorkspace clips anything wider than the pane.
  return (
    <div className="@container mb-1 shrink-0">
      <div
        role="toolbar"
        aria-label="Filters"
        className="relative flex flex-wrap items-center gap-2 p-1 @2xl:h-10 @2xl:flex-nowrap @2xl:py-0"
      >
        <KeywordBox
          value={keyword}
          onChange={onKeywordChange}
          placeholder={keywordPlaceholder}
        />

        {definitions.length > 0 && (
          <FiltersMenu
            menu={{
              ...menu,
              setOpen: (next) => {
                if (next) countActiveFacets();
                menu.setOpen(next);
              },
            }}
            menuFields={menuFields}
            groupOf={groupOf}
            viewOf={viewOf}
            isDefined={isDefined}
            labelFor={labelFor}
            filters={filters}
            facetActions={facetActions}
            refreshing={refreshing}
            activeCount={activeFields.length}
            toggleValue={toggleValue}
            setFieldValues={setFieldValues}
            facetsError={facetsError}
            facetsUnavailable={facetsUnavailable}
            onPrefetchFacets={onPrefetchFacets}
          />
        )}

        <div
          ref={trackRef}
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1 transition-opacity duration-100 @2xl:h-full",
            !measured && "opacity-0",
          )}
        >
          {rowFields.length > 0 && (
            <span
              aria-hidden="true"
              className="mr-0.5 h-5 w-px shrink-0 bg-border"
            />
          )}
          {shownPills.map((field) => (
            <ActiveFilterPill
              key={field}
              view={viewOf(field)}
              refreshing={refreshing}
              error={facetsError}
              unavailable={facetsUnavailable}
              onToggle={(value) => {
                toggleValue(field, value);
              }}
              onClear={() => {
                setFieldValues(field, []);
              }}
              onOpenChange={(open) => {
                if (open) {
                  setHeldField(field);
                  countActiveFacets();
                } else {
                  setHeldField((current) => (current === field ? null : current));
                }
              }}
            />
          ))}
          {hiddenPills.length > 0 && (
            <button
              type="button"
              aria-label={`${String(hiddenPills.length)} more filters: ${hiddenPillLabels}. Open in the Filters menu`}
              title={hiddenPillLabels}
              onClick={() => {
                countActiveFacets();
                menu.openAt(hiddenPills[0]);
              }}
              className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MorePillFace count={hiddenPills.length} />
            </button>
          )}
        </div>

        {facetsErrorMessage && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    role="alert"
                    tabIndex={0}
                    className="flex max-w-56 items-center gap-1 rounded-sm text-xs text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
              >
                <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{facetsErrorMessage}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{facetsErrorMessage}</TooltipContent>
            </Tooltip>
            {onRetryFacets && (
              <QueryRetryButton
                size="toolbar"
                retrying={facetsRetrying}
                onRetry={onRetryFacets}
              />
            )}
          </div>
        )}

        {hasExplicitRql && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 text-2xs font-medium text-info outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              }
            >
              <Braces aria-hidden="true" className="size-3" />
              Custom query
            </TooltipTrigger>
            <TooltipContent side="bottom">
              The link carries a hand-written query the filters cannot show.
              Clear all removes it.
            </TooltipContent>
          </Tooltip>
        )}

        {canClear && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="toolbar"
              onClick={clearAll}
            >
              Clear all
            </Button>
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          </>
        )}

        {columns.length > 0 && (
          <ColumnsMenu
            columns={columns}
            setColumns={setColumns}
            resetColumns={resetColumns}
          />
        )}

        {/* Off-screen copies of every row pill (and the "+N" pill) at their
            natural width, so the overflow can be computed. */}
        <div
          ref={measureRef}
          inert
          aria-hidden="true"
          className="invisible absolute inset-x-0 top-0 flex h-0 gap-1.5 overflow-hidden"
        >
          {rowFields.map((field) => (
            <div
              key={field}
              data-measure-field={field}
              data-measure-held={field === heldField || undefined}
              className="shrink-0"
            >
              <PillFace label={labelFor(field)} values={filters[field] ?? []} />
            </div>
          ))}
          <div data-measure-more className="shrink-0">
            <MorePillFace count={9} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KeywordBox({
  value,
  onChange,
  placeholder = "Search keywords…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "flex h-8 w-full shrink-0 items-center gap-1.5 rounded-md border bg-background pr-1 pl-2 transition-[width] duration-100 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 motion-reduce:transition-none @2xl:w-44 @2xl:focus-within:w-64",
        value ? "border-primary/60 @2xl:w-56" : "border-input",
      )}
    >
      <Search
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        aria-label="Search keywords"
        enterKeyHint="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear keyword"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
