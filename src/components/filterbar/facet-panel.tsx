"use client";

import { useQuery } from "@tanstack/react-query";
import { FacetColumn } from "./facet-column";
import { Skeleton } from "@/components/ui/skeleton";
import { DataRepository, collectionQueryOptions } from "@/lib/data-api";
import type { DataResource } from "@/lib/data-api";

// Same-origin Data API entrypoint (`/api/data/<resource>`). Stateless wrapper
// around fetch, so one module-level instance is the established pattern.
const dataRepository = new DataRepository();

// A facet read wants counts, not rows, so it asks for the smallest page the
// gateway allows (`pageSize` is validated as >= 1) and ignores the rows.
const facetPageSize = 1;

interface FacetPanelProps {
  /**
   * The facets to render, which is also exactly the set counts are requested
   * for. The caller owns which facets are shown (`FilterBar`'s chooser), so a
   * collapsed facet costs no facet work upstream.
   */
  fields: { id: string; label: string }[];
  /** RQL predicate the facet counts are computed over. */
  query: string;
  resource: DataResource;
  onSelect: (field: string, value: string) => void;
}

export function FacetPanel({
  fields,
  query,
  resource,
  onSelect,
}: FacetPanelProps) {
  const validFieldIds = fields
    .map((field) => field.id)
    .filter((id) => id.trim());

  const request = {
    rql: query || undefined,
    pageSize: facetPageSize,
    facets: validFieldIds,
  };

  const {
    data: collection,
    error,
    isLoading,
  } = useQuery({
    // Same shared options `list-data.tsx` spreads, so the key and the call are
    // built in one place. Its `keepPreviousData` default is what keeps the
    // previous counts on screen during a background refetch — no flash, no
    // spinner — so only `enabled` and the facet-specific stale window differ.
    ...collectionQueryOptions(dataRepository, resource, request),
    enabled: validFieldIds.length > 0,
    staleTime: 30_000,
  });

  if (error) {
    return (
      <div className="flex max-h-30 items-center rounded bg-background p-2 text-[11px] text-muted-foreground">
        Facets unavailable
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex max-h-30 gap-3 overflow-auto rounded bg-background p-2 text-[11px]">
        {fields.map((field) => (
          <div key={field.id} className="shrink-0">
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex max-h-30 gap-3 overflow-auto rounded bg-background p-2 text-[11px]">
      {fields.map((field) => (
        <FacetColumn
          key={field.id}
          field={field}
          items={(collection?.facets[field.id] ?? []).map((bucket) => ({
            label: String(bucket.value),
            value: String(bucket.value),
            count: bucket.count,
          }))}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
