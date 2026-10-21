"use client";

import { useEffect, useState } from "react";
import { useDebouncedDraft } from "@/hooks/use-debounced-draft";
import { useTableLayout } from "@/hooks/use-table-layout";
import type {
  FacetStatus,
  ResourceFacets,
} from "@/hooks/views/use-resource-collection";
import {
  diffBooleanOverrides,
  resolveFacetVisibility,
} from "@/lib/table-layout";
import type { CollectionState } from "@/lib/views/collection-state";
import { CollectionToolbar } from "./collection-filters/collection-toolbar";
import type { CollectionColumnControls } from "./collection-filters/types";
import type { ResourceCollectionFacet } from "./resource-collection";

interface ResourceFilterBarProps extends CollectionColumnControls {
  /**
   * Table-layout key the pinned facets are remembered under. Pass the resource
   * table's own key, so its column and facet choices live in one entry.
   */
  layoutKey: string;
  keyword?: string;
  filters: CollectionState["filters"];
  facets: ResourceFacets;
  /** Each counted facet's status (`useResourceCollection`'s `facetStatuses`). */
  facetStatuses: Partial<Record<string, FacetStatus>>;
  /** Why the counts could not be loaded, already formatted for display. */
  facetsError?: string;
  onRetryFacets?: () => void;
  /** The facets' Retry is in flight: `facetsError` stays, its button says so. */
  facetsRetrying?: boolean;
  /**
   * The counts failed along with the rows, whose alert already says why and
   * whose Retry reloads both: a muted note stands in for the values rather
   * than a second red error for the same failure.
   */
  facetsUnavailable?: boolean;
  /** Facets outside the pinned set counted because the user opened them. */
  peekedFields: ReadonlySet<string>;
  onPeekedFieldsChange: (fields: ReadonlySet<string>) => void;
  /** A menu or pill opened: start (and keep) counting the facets. */
  onFacetsWanted: () => void;
  /** The pointer or focus is on Filters: start the counts before the click. */
  onPrefetchFacets: () => void;
  definitions: readonly ResourceCollectionFacet[];
  hasExplicitRql?: boolean;
  /**
   * Filters that stay beside the explicit rql (`filtersBesideRql`): picking one
   * of their values keeps the rql, where any other pick replaces it.
   */
  filtersBesideRql?: readonly string[];
  keywordPlaceholder?: string;
  onChange: (update: {
    keyword?: string;
    filters: CollectionState["filters"];
    clearRql?: boolean;
    /** "Clear all": remove every filter, a view's defaults included. */
    clearAll?: boolean;
  }) => void;
}

/**
 * How long a pick may show before the page's own filters catch up: a value
 * the page drops (a facet it cannot filter on) reverts after this.
 */
const optimisticFiltersMs = 3000;

/**
 * The collection's filter toolbar, bound to its state: the keyword draft, the
 * pinned facets in the table layout, and filter writes. A pick shows at once:
 * a page's filters come back with the server render the URL write starts, so
 * the toolbar is given the picked filters until the page's match them.
 */
export function ResourceFilterBar({
  layoutKey,
  keyword,
  filters,
  facets,
  facetStatuses,
  facetsError,
  onRetryFacets,
  facetsRetrying = false,
  facetsUnavailable = false,
  peekedFields,
  onPeekedFieldsChange,
  onFacetsWanted,
  onPrefetchFacets,
  definitions,
  hasExplicitRql = false,
  filtersBesideRql = [],
  keywordPlaceholder,
  onChange,
  columns,
  setColumns,
  resetColumns,
}: ResourceFilterBarProps) {
  const [optimistic, setOptimistic] = useState<{
    filters: CollectionState["filters"];
    /** The pick replaced the explicit rql, which the page still holds. */
    clearRql: boolean;
  } | null>(null);
  const optimisticMatched =
    optimistic !== null &&
    JSON.stringify(optimistic.filters) === JSON.stringify(filters);
  if (optimisticMatched) setOptimistic(null);
  useEffect(() => {
    if (!optimistic) return;
    const timer = window.setTimeout(() => {
      setOptimistic(null);
    }, optimisticFiltersMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [optimistic]);
  const pending = optimistic && !optimisticMatched ? optimistic : null;
  // `filters` itself, not a copy, when nothing is pending: loaded keyword mode
  // tells a keyword-only write apart by that identity.
  const shownFilters = pending ? pending.filters : filters;

  // Every write starts from what is shown, so a write made before the page
  // catches up (a keyword commit, a second pick) carries the pending pick and
  // its rql replacement instead of the page's stale filters.
  const [keywordDraft, setKeywordDraft] = useDebouncedDraft(
    keyword ?? "",
    (value) => {
      onChange({
        keyword: value || undefined,
        filters: shownFilters,
        clearRql: pending?.clearRql,
      });
    },
    { normalize: (value) => value.trim() },
  );
  const [layout, updateLayout] = useTableLayout(layoutKey);
  const { defaults: defaultFacetVisibility, visibility: facetVisibility } =
    resolveFacetVisibility(definitions, layout.facets);
  const pinnedFields = new Set(
    Object.keys(facetVisibility).filter((field) => facetVisibility[field]),
  );

  const setFieldValues = (field: string, values: string[]) => {
    const next = { ...shownFilters };
    if (values.length > 0) next[field] = values;
    else Reflect.deleteProperty(next, field);
    const clearRql =
      Boolean(pending?.clearRql) ||
      (hasExplicitRql && !filtersBesideRql.includes(field));
    setOptimistic({ filters: next, clearRql });
    onChange({ keyword, filters: next, clearRql });
  };

  return (
    <CollectionToolbar
      keyword={keywordDraft}
      onKeywordChange={setKeywordDraft}
      keywordPlaceholder={keywordPlaceholder}
      definitions={definitions}
      pinnedFields={pinnedFields}
      setFieldPinned={(field, pinned) => {
        updateLayout({
          facets: diffBooleanOverrides(defaultFacetVisibility, {
            ...facetVisibility,
            [field]: pinned,
          }),
        });
      }}
      peekedFields={peekedFields}
      setPeekedFields={onPeekedFieldsChange}
      facets={facets}
      facetStatus={(field) => facetStatuses[field] ?? "loading"}
      facetsError={facetsError}
      onRetryFacets={onRetryFacets}
      facetsRetrying={facetsRetrying}
      facetsUnavailable={facetsUnavailable}
      onFacetsWanted={onFacetsWanted}
      onPrefetchFacets={onPrefetchFacets}
      filters={shownFilters}
      toggleValue={(field, value) => {
        const current = shownFilters[field] ?? [];
        setFieldValues(
          field,
          current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value],
        );
      }}
      setFieldValues={setFieldValues}
      clearAll={() => {
        setKeywordDraft("");
        setOptimistic({ filters: {}, clearRql: true });
        onChange({
          keyword: undefined,
          filters: {},
          clearRql: true,
          clearAll: true,
        });
      }}
      canClear={
        Boolean(keywordDraft) ||
        Object.keys(shownFilters).length > 0 ||
        hasExplicitRql
      }
      hasExplicitRql={hasExplicitRql}
      columns={columns}
      setColumns={setColumns}
      resetColumns={resetColumns}
    />
  );
}
