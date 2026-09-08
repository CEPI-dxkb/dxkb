"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { KeywordSearch } from "@/components/filterbar/keyword-search";
import { FacetColumn } from "@/components/filterbar/facet-column";
import { SelectedFilters } from "@/components/filterbar/selected-filters";
import type { ResourceFacets } from "@/hooks/views/use-resource-collection";
import type { CollectionState } from "@/lib/views/collection-state";
import type { ResourceCollectionFacet } from "./resource-collection";

interface ResourceFilterBarProps {
  keyword?: string;
  filters: CollectionState["filters"];
  facets: ResourceFacets;
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
  keyword,
  filters,
  facets,
  definitions,
  hasExplicitRql = false,
  keywordPlaceholder,
  onChange,
}: ResourceFilterBarProps) {
  const [keywordDraft, setKeywordDraft] = useState(keyword ?? "");
  const [showFacets, setShowFacets] = useState(false);
  const [visibleFacets, setVisibleFacets] = useState(
    () =>
      new Set(
        definitions
          .filter((definition) => definition.initiallyVisible !== false)
          .map((definition) => definition.field),
      ),
  );
  const [facetMenuOpen, setFacetMenuOpen] = useState(false);

  const externalKeyword = keyword ?? "";
  const [previousKeyword, setPreviousKeyword] = useState(externalKeyword);
  if (previousKeyword !== externalKeyword) {
    setPreviousKeyword(externalKeyword);
    setKeywordDraft(externalKeyword);
  }

  const commitKeyword = useEffectEvent((value: string) => {
    onChange({
      keyword: value.trim() || undefined,
      filters,
    });
  });

  useEffect(() => {
    if (keywordDraft === (keyword ?? "")) return;
    const timeout = setTimeout(() => {
      commitKeyword(keywordDraft);
    }, 300);
    return () => {
      clearTimeout(timeout);
    };
  }, [keyword, keywordDraft]);

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
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFacetMenuOpen((current) => !current);
                }}
                className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-700"
              >
                Facets
              </Button>
              {facetMenuOpen && (
                <div className="absolute right-0 z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded border bg-background shadow-lg">
                  {definitions.map((definition) => (
                    <label
                      key={definition.field}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={visibleFacets.has(definition.field)}
                        onChange={() => {
                          setVisibleFacets((current) => {
                            const next = new Set(current);
                            if (next.has(definition.field))
                              next.delete(definition.field);
                            else next.add(definition.field);
                            return next;
                          });
                        }}
                      />
                      {definition.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={!keywordDraft && selected.length === 0 && !hasExplicitRql}
            onClick={() => {
              setKeywordDraft("");
              onChange({ keyword: undefined, filters: {}, clearRql: true });
            }}
            className="rounded border px-2 py-1 text-xs whitespace-nowrap"
          >
            Clear All Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowFacets((current) => !current);
            }}
            className="rounded border border-gray-400 px-2 py-1 text-xs whitespace-nowrap hover:bg-gray-700"
          >
            {showFacets ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>
      </div>
      {showFacets && (
        <div className="flex max-h-30 gap-3 overflow-auto rounded bg-gray-800 p-2 text-[11px]">
          {definitions
            .filter((definition) => visibleFacets.has(definition.field))
            .map((definition) => (
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
            ))}
        </div>
      )}
    </div>
  );
}
