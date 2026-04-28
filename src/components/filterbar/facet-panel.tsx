"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { FacetColumn } from "./facet-column";
import { SelectedFilter } from "@/types/filters";

interface FacetItem {
  label: string;
  value: string;
  count: number;
};

interface ColumnField {
  id: string;
  label: string;
  facet?: boolean;
  facet_hidden?: boolean;
};

interface FacetPanelProps {
  fields: ColumnField[];
  query: string;
  resource: string;
  onSelect: (field: string, value: string) => void;
  selected: SelectedFilter[];
};

// ------------------------------
// Parse Solr facet response
// ------------------------------
function parseFacetCounts(
  facets: Record<string, any[]>
): Record<string, FacetItem[]> {
  const out: Record<string, FacetItem[]> = {};

  Object.keys(facets || {}).forEach((cat) => {
    const data = facets[cat] || [];
    out[cat] = [];

    for (let i = 0; i < data.length - 1; i += 2) {
      out[cat].push({
        label: data[i],
        value: data[i],
        count: data[i + 1],
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
  selected,
}: FacetPanelProps) {
  const [facets, setFacets] = useState<Record<string, FacetItem[]>>({});
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;
  const requestId = useRef(0);

  const visibleFacets = useMemo(() => {
    return fields
      .filter(f => f.facet && !f.facet_hidden)
      .map(f => f.id);
  }, [fields]);

  useEffect(() => {
    if (!DataAPI) return;
    if (!resource) return;
    if (!fields || fields.length === 0) {
      console.warn("FacetPanel: fields not ready yet — skipping fetch");
      return;
    }

    const fetchFacets = async () => {
      const currentRequest = ++requestId.current;

      try {

        // ---------------------------------------------------
        // EXTRACT VALID FIELDS
        // ---------------------------------------------------
        const validFields = fields
          .filter((f): f is ColumnField =>
            f &&
            typeof f.id === "string" &&
            f.id.trim().length > 0
          )
          .map(f => f.id);
          
        if (validFields.length === 0) {
          console.warn("FacetPanel: no valid facet fields", fields);
          return;
        }

        // ---------------------------------------------------
        // BUILD FACET STRING 
        // ---------------------------------------------------
        const facetFieldsStr = validFields.join(",");

        if (!facetFieldsStr) {
          console.warn("FacetPanel: facetFieldsStr empty");
          return;
        }

        const facetStr = `facet(${facetFieldsStr},(mincount,1),(limit,100))`;
        const filterStr = selected
          .map(f => `eq(${f.field},${f.value})`)
          .join(",");
          
        const RQLstring = [
          query || "",
          filterStr,
          "limit(1)",
          facetStr
        ]
          .filter(Boolean)
          .join("&");

        const url = `${DataAPI}/${resource}/?${RQLstring}`;
        console.log("Fetching facets with URL:", url);
        // ---------------------------------------------------
        // FETCH
        // ---------------------------------------------------
        const res = await fetch(url, {
          headers: {
            "Accept": "application/solr+json",
          },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Facet error response:", text);
          throw new Error("Failed to fetch facets");
        }

        const json = await res.json();

        // ---------------------------------------------------
        // PARSE RESPONSE
        // ---------------------------------------------------
 // 🚨 ignore stale responses
        if (currentRequest !== requestId.current) return;
        
        const parsed = parseFacetCounts(
          json?.facet_counts?.facet_fields || {}
        );

        setFacets(parsed);
      } catch (err) {
        console.error("Facet fetch error:", err);
      }
    };

    fetchFacets();
  }, [fields, query, resource, DataAPI]);

  return (
    <div className="flex gap-3 overflow-x-auto max-h-[120px] overflow-y-auto bg-gray-800 p-2 rounded text-[11px]">
      {fields
      .filter(f => visibleFacets.includes(f.id))
      .map((field) => (
        <FacetColumn
          key={field.id}
          field={field}
          items={facets[field.id] || []}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}