import { useEffect, useEffectEvent, useState, useRef } from "react";
import { buildRql, combineRql } from "./filter-utils";
import { KeywordSearch } from "./keyword-search";
import { SelectedFilters } from "./selected-filters";
import { FacetPanel } from "./facet-panel";
import { SelectedFilter } from "@/types/filters";
import { Button } from "@/components/ui/button";
import type { DataResource } from "@/lib/data-api";

interface ColumnField {
  id: string;
  label: string;
  visible: boolean;
  facet?: boolean;
  facet_hidden?: boolean;
}

interface FilterBarProps {
  facetFields: ColumnField[];
  onFilterChange: (rql: string) => void;
  resource: DataResource;
  /** RQL predicate the list is already filtered by, which facet counts respect. */
  query: string;
  keywordValue?: string;
  onKeywordChange?: (value: string) => void;
  keywordMode?: "server" | "loaded";
}

export function FilterBar({
  facetFields,
  onFilterChange,
  resource,
  query,
  keywordValue,
  onKeywordChange,
  keywordMode = "server",
}: FilterBarProps) {
  const [internalKeywords, setInternalKeywords] = useState<string[]>([]);
  const keywords =
    keywordValue === undefined
      ? internalKeywords
      : keywordValue.split(" ").filter(Boolean);
  const setKeywords = (nextKeywords: string[]) => {
    if (keywordValue === undefined) setInternalKeywords(nextKeywords);
    else locallyRequestedKeywords.current = nextKeywords.join(" ");
    onKeywordChange?.(nextKeywords.join(" "));
  };
  const [selected, setSelected] = useState<SelectedFilter[]>([]);
  const [showFacets, setShowFacets] = useState(false);
  const [localFacetFields, setLocalFacetFields] = useState<ColumnField[]>(
    () => facetFields,
  );
  const [facetMenuOpen, setFacetMenuOpen] = useState(false);
  const facetMenuRef = useRef<HTMLDivElement | null>(null);
  const locallyRequestedKeywords = useRef<string | null>(null);
  const syncExternalKeywords = useEffectEvent((value: string) => {
    if (locallyRequestedKeywords.current === value) {
      locallyRequestedKeywords.current = null;
      return;
    }
    onFilterChange(
      buildRql({ selected, keywords: value.split(" ").filter(Boolean) }),
    );
  });

  useEffect(() => {
    if (keywordValue !== undefined) syncExternalKeywords(keywordValue);
  }, [keywordValue]);

  const updateFilters = (
    nextSelected: SelectedFilter[],
    nextKeywords: string[],
  ) => {
    setSelected(nextSelected);
    setKeywords(nextKeywords);
    onFilterChange(
      buildRql({
        selected: nextSelected,
        keywords: keywordMode === "loaded" ? [] : nextKeywords,
      }),
    );
  };
  const clearAll = () => {
    updateFilters([], []);
  };

  const activeFacetFields: ColumnField[] = [];
  const configurableFacetFields: ColumnField[] = [];
  for (const field of localFacetFields) {
    if (!field.facet) continue;
    configurableFacetFields.push(field);
    if (!field.facet_hidden) activeFacetFields.push(field);
  }

  const toggleFacetVisibility = (id: string) => {
    setLocalFacetFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, facet_hidden: !f.facet_hidden } : f,
      ),
    );
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        facetMenuRef.current &&
        !facetMenuRef.current.contains(e.target as Node)
      ) {
        setFacetMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filterRql = buildRql({
    selected,
    keywords: keywordMode === "loaded" ? [] : keywords,
  });
  const facetQuery = combineRql(query, filterRql);

  return (
    <div className="mt-0 mb-2 flex flex-col gap-1 p-1 text-sm">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-2">
        {/* LEFT SIDE */}
        <div className="flex flex-1 flex-col gap-1">
          <KeywordSearch
            value={keywords.join(" ")}
            onChange={(val) => {
              if (keywordMode === "loaded") {
                setKeywords(val.split(" ").filter(Boolean));
                return;
              }
              updateFilters(selected, val.split(" ").filter(Boolean));
            }}
          />

          <SelectedFilters
            selected={selected}
            onRemove={(idx) => {
              updateFilters(
                selected.filter((_, index) => index !== idx),
                keywords,
              );
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* FACET DROPDOWN */}
          {showFacets && (
            <div className="relative" ref={facetMenuRef}>
              <Button
                variant="outline"
                onClick={() => {
                  setFacetMenuOpen((prev) => !prev);
                }}
                className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-700"
              >
                Facets ⚙
              </Button>

              {facetMenuOpen && (
                <div className="absolute right-0 z-9999 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-gray-600 bg-gray-800 shadow-lg">
                  {configurableFacetFields.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={!f.facet_hidden}
                        onChange={() => {
                          toggleFacetVisibility(f.id);
                        }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLEAR ALL */}
          <Button
            variant="outline"
            onClick={clearAll}
            disabled={selected.length === 0 && keywords.length === 0}
            className={`rounded border px-2 py-1 text-xs whitespace-nowrap ${
              selected.length === 0 && keywords.length === 0
                ? "cursor-not-allowed border-gray-600 text-gray-500"
                : "border-red-400 text-red-300 hover:bg-red-900"
            }`}
          >
            Clear All Filters
          </Button>

          {/* SHOW/HIDE FILTERS */}
          <Button
            variant="outline"
            onClick={() => {
              setShowFacets((prev) => !prev);
            }}
            className="rounded border border-gray-400 px-2 py-1 text-xs whitespace-nowrap hover:bg-gray-700"
          >
            {showFacets ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>
      </div>

      {/* FACET PANEL */}
      {showFacets && (
        <FacetPanel
          fields={activeFacetFields}
          resource={resource}
          query={facetQuery}
          onSelect={(field, value) => {
            const exists = selected.some(
              (filter) => filter.field === field && filter.value === value,
            );
            if (!exists) {
              updateFilters(
                [...selected, { field, value, op: "eq" as const }],
                keywords,
              );
            }
          }}
        />
      )}
    </div>
  );
}
