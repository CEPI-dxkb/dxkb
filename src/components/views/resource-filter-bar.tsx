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
  layoutKey: string;
  keyword?: string;
  filters: CollectionState["filters"];
  facets: ResourceFacets;
  facetStatuses: Partial<Record<string, FacetStatus>>;
  facetsError?: string;
  onRetryFacets?: () => void;
  facetsRetrying?: boolean;
  facetsUnavailable?: boolean;
  peekedFields: ReadonlySet<string>;
  onPeekedFieldsChange: (fields: ReadonlySet<string>) => void;
  onFacetsWanted: () => void;
  onPrefetchFacets: () => void;
  definitions: readonly ResourceCollectionFacet[];
  hasExplicitRql?: boolean;
  filtersBesideRql?: readonly string[];
  keywordPlaceholder?: string;
  onChange: (update: {
    keyword?: string;
    filters: CollectionState["filters"];
    clearRql?: boolean;
    clearAll?: boolean;
  }) => void;
}

const optimisticFiltersMs = 3000;

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
  // tells a keyword-only write apart by identity.
  const shownFilters = pending ? pending.filters : filters;

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
