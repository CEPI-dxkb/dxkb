"use client";

import { useQuery } from "@tanstack/react-query";
import { FacetColumn } from "./facet-column";
import { Skeleton } from "@/components/ui/skeleton";

interface FacetItem {
  label: string;
  value: string;
  count: number;
}

interface ColumnField {
  id: string;
  label: string;
  facet?: boolean;
  facet_hidden?: boolean;
}

interface FacetPanelProps {
  fields: ColumnField[];
  query: string;
  resource: string;
  onSelect: (field: string, value: string) => void;
}

// ------------------------------
// Parse Solr facet response
// ------------------------------
function parseFacetCounts(
  facets: Record<string, (string | number)[]>,
): Record<string, FacetItem[]> {
  const out: Record<string, FacetItem[]> = {};

  Object.keys(facets).forEach((cat) => {
    const data = facets[cat];
    out[cat] = [];

    for (let i = 0; i < data.length - 1; i += 2) {
      const label = String(data[i]);
      out[cat].push({
        label,
        value: label,
        count: Number(data[i + 1]),
      });
    }
  });

  return out;
}

export function FacetPanel({
  fields,
  query,
  resource,
  onSelect,
}: FacetPanelProps) {
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;

  const visibleFields: ColumnField[] = [];
  const validFieldIds: string[] = [];
  for (const field of fields) {
    if (field.id.trim()) validFieldIds.push(field.id);
    if (field.facet && !field.facet_hidden) visibleFields.push(field);
  }

  const {
    data: facets,
    error,
    isLoading,
  } = useQuery<Record<string, FacetItem[]>>({
    queryKey: ["facets", resource, query, validFieldIds],
    queryFn: async ({ signal }) => {
      const facetStr = `facet(${validFieldIds.join(",")},(mincount,1),(limit,100))`;
      const rql = [query || "", "limit(1)", facetStr].filter(Boolean).join("&");
      const res = await fetch(`${DataAPI as string}/${resource}/?${rql}`, {
        signal,
        headers: { Accept: "application/solr+json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as {
        facet_counts?: { facet_fields?: Record<string, (string | number)[]> };
      };
      return parseFacetCounts(json.facet_counts?.facet_fields ?? {});
    },
    enabled: !!DataAPI && !!resource && validFieldIds.length > 0,
    // Keep previous data visible during background refetch — no flash or spinner
    placeholderData: (prev) => prev,
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
        {visibleFields.map((field) => (
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
      {visibleFields.map((field) => (
        <FacetColumn
          key={field.id}
          field={field}
          items={facets?.[field.id] ?? []}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
