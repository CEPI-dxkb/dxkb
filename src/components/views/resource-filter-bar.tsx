"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { KeywordSearch } from "@/components/filterbar/keyword-search";
import { FacetColumn } from "@/components/filterbar/facet-column";
import { SelectedFilters } from "@/components/filterbar/selected-filters";
import { useDebouncedDraft } from "@/hooks/use-debounced-draft";
import { useTableLayout } from "@/hooks/use-table-layout";
import type { ResourceFacets } from "@/hooks/views/use-resource-collection";
import {
  diffBooleanOverrides,
  resolveFacetVisibility,
} from "@/lib/table-layout";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import type { CollectionState } from "@/lib/views/collection-state";
import type { ResourceCollectionFacet } from "./resource-collection";

interface ResourceFilterBarProps {
  /**
   * Table-layout key the shown facets are remembered under. Pass the resource
   * table's own key, so its column and facet choices live in one entry.
   */
  layoutKey: string;
  keyword?: string;
  filters: CollectionState["filters"];
  facets: ResourceFacets;
  /** No counts have arrived yet for this scope; they load apart from the rows. */
  facetsLoading?: boolean;
  /**
   * The counts on screen belong to the previous scope or facet set and new ones
   * are on the way. Columns with previous counts stay, marked stale; a column
   * that was never counted shows a placeholder.
   */
  facetsRefreshing?: boolean;
  /** Why the counts could not be loaded, already formatted for display. */
  facetsError?: string;
  onRetryFacets?: () => void;
  definitions: readonly ResourceCollectionFacet[];
  hasExplicitRql?: boolean;
  keywordPlaceholder?: string;
  onChange: (update: {
    keyword?: string;
    filters: CollectionState["filters"];
    clearRql?: boolean;
  }) => void;
}

export function ResourceFilterBar({
  layoutKey,
  keyword,
  filters,
  facets,
  facetsLoading = false,
  facetsRefreshing = false,
  facetsError,
  onRetryFacets,
  definitions,
  hasExplicitRql = false,
  keywordPlaceholder,
  onChange,
}: ResourceFilterBarProps) {
  const [keywordDraft, setKeywordDraft] = useDebouncedDraft(
    keyword ?? "",
    (value) => {
      onChange({
        keyword: value || undefined,
        filters,
      });
    },
    { normalize: (value) => value.trim() },
  );
  const [showFacets, setShowFacets] = useUiPreference("facetPanelOpen");
  const [layout, updateLayout] = useTableLayout(layoutKey);
  const { defaults: defaultFacetVisibility, visibility: facetVisibility } =
    resolveFacetVisibility(definitions, layout.facets);
  const visibleFacets = new Set(
    Object.keys(facetVisibility).filter((field) => facetVisibility[field]),
  );

  const selected = Object.entries(filters).flatMap(([field, values]) =>
    values.map((value) => ({ field, value })),
  );

  return (
    <div className="mt-0 mb-2 flex flex-col gap-1 p-1 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <KeywordSearch
            value={keywordDraft}
            onChange={setKeywordDraft}
            placeholder={keywordPlaceholder}
          />
          <SelectedFilters
            selected={selected}
            onRemove={(index) => {
              const removed = selected[index];
              const next = { ...filters };
              const remaining = (next[removed.field] ?? []).filter(
                (value) => value !== removed.value,
              );
              if (remaining.length > 0) next[removed.field] = remaining;
              else Reflect.deleteProperty(next, removed.field);
              onChange({ keyword, filters: next });
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          {showFacets && definitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="toolbar"
                  >
                    Facets
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                {definitions.map((definition) => (
                  <DropdownMenuCheckboxItem
                    key={definition.field}
                    checked={visibleFacets.has(definition.field)}
                    onCheckedChange={(checked) => {
                      updateLayout({
                        facets: diffBooleanOverrides(defaultFacetVisibility, {
                          ...facetVisibility,
                          [definition.field]: checked,
                        }),
                      });
                    }}
                  >
                    {definition.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={!keywordDraft && selected.length === 0 && !hasExplicitRql}
            onClick={() => {
              setKeywordDraft("");
              onChange({ keyword: undefined, filters: {}, clearRql: true });
            }}
            size="toolbar"
          >
            Clear All Filters
          </Button>
          {definitions.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowFacets((current) => !current);
              }}
              size="toolbar"
            >
              {showFacets ? "Hide Filters" : "Show Filters"}
            </Button>
          )}
        </div>
      </div>
      {showFacets && definitions.length > 0 && (
        <div
          aria-busy={facetsLoading || facetsRefreshing || undefined}
          data-stale={facetsRefreshing || undefined}
          className="flex max-h-30 gap-3 overflow-auto rounded bg-background p-2 text-2xs data-stale:opacity-60"
        >
          {facetsError ? (
            <div
              role="alert"
              className="flex items-center gap-2 text-destructive"
            >
              <p>Could not load filter values: {facetsError}</p>
              {onRetryFacets && (
                <Button
                  type="button"
                  variant="outline"
                  size="toolbar"
                  onClick={onRetryFacets}
                >
                  Retry
                </Button>
              )}
            </div>
          ) : (
            definitions
              .filter((definition) => visibleFacets.has(definition.field))
              .map((definition) =>
                facetsLoading ||
                (facetsRefreshing &&
                  !Object.hasOwn(facets, definition.field)) ? (
                  <FacetColumnSkeleton key={definition.field} />
                ) : (
                  <FacetColumn
                    key={definition.field}
                    field={{ id: definition.field, label: definition.label }}
                    items={(facets[definition.field] ?? []).map((item) => ({
                      label: String(item.value),
                      value: String(item.value),
                      count: item.count,
                    }))}
                    onSelect={(field, value) => {
                      const current = filters[field] ?? [];
                      if (current.includes(value)) return;
                      onChange({
                        keyword,
                        filters: { ...filters, [field]: [...current, value] },
                        clearRql: hasExplicitRql,
                      });
                    }}
                  />
                ),
              )
          )}
        </div>
      )}
    </div>
  );
}

/** Placeholder for one facet column; the sizes match `FacetPanel`'s. */
function FacetColumnSkeleton() {
  return (
    <div aria-hidden="true" className="shrink-0">
      <Skeleton className="mb-2 h-3 w-24" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </div>
  );
}
