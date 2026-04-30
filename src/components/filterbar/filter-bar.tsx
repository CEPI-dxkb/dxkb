import { useEffect, useState, useRef } from "react";
import { buildRql } from "./filter-utils";
import { KeywordSearch } from "./keyword-search";
import { SelectedFilters } from "./selected-filters";
import { FacetPanel } from "./facet-panel";
import { SelectedFilter } from "@/types/filters";
import { Button } from "@/components/ui/button";

interface ColumnField {
  id: string;
  label: string;
  visible: boolean;
  facet?: boolean;
  facet_hidden?: boolean; 
};

interface FilterBarProps {
  facetFields: ColumnField[];
  onFilterChange: (rql: string) => void;
  resource: string;
  query: string;
};

export function FilterBar({ facetFields, onFilterChange, resource, query }: FilterBarProps) {
  
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedFilter[]>([]);
  const [showFacets, setShowFacets] = useState(false);
  const [localFacetFields, setLocalFacetFields] = useState<ColumnField[]>(() => facetFields ?? []);
  const [facetMenuOpen, setFacetMenuOpen] = useState(false);
  const facetMenuRef = useRef<HTMLDivElement | null>(null);
  const clearAll = () => {
    setSelected([]);
    setKeywords([]);
  };

  const activeFacetFields = localFacetFields.filter(
    (f) => f.facet && !f.facet_hidden
  );

  const toggleFacetVisibility = (id: string) => {
    setLocalFacetFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, facet_hidden: !f.facet_hidden } : f
      )
    );
  };

  // Parent passes onFilterChange inline (new ref every render); keep it in a
  // ref so the effect only fires on filter-state changes, not on every render.
  const onFilterChangeRef = useRef(onFilterChange);
  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  });

  // emit filter upward
  useEffect(() => {
    const rql = buildRql({ selected, keywords });
    onFilterChangeRef.current?.(rql);
  }, [selected, keywords]);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1 p-1 text-sm mt-0 mb-2">
      
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-2">
        
        {/* LEFT SIDE */}
        <div className="flex flex-col gap-1 flex-1">
          <KeywordSearch
            value={keywords.join(" ")}
            onChange={(val) => setKeywords(val.split(" ").filter(Boolean))}
          />

          <SelectedFilters
            selected={selected}
            onRemove={(idx) => {
              setSelected((prev) => prev.filter((_, i) => i !== idx));
            }}
          />
        </div>

        <div className="flex items-center gap-2">

          {/* FACET DROPDOWN */}
          {showFacets && (
            <div className="relative" ref={facetMenuRef}>
                  <Button
                    variant="outline"
                    onClick={() => setFacetMenuOpen((prev) => !prev)}
                    className="text-xs px-2 py-1 border border-gray-400 rounded hover:bg-gray-700"
                  >
                    Facets ⚙
                  </Button>

              {facetMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-lg z-[9999]">
                  {localFacetFields
                    .filter((f) => f.facet)
                    .map((f) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!f.facet_hidden}
                          onChange={() => toggleFacetVisibility(f.id)}
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
            className={`text-xs px-2 py-1 border rounded whitespace-nowrap ${
              selected.length === 0 && keywords.length === 0
                ? "border-gray-600 text-gray-500 cursor-not-allowed"
                : "border-red-400 text-red-300 hover:bg-red-900"
            }`}          
          >
          Clear All Filters
          </Button>


          {/* SHOW/HIDE FILTERS */}
            <Button
              variant="outline"
              onClick={() => setShowFacets((prev) => !prev)}
              className="text-xs px-2 py-1 border border-gray-400 rounded hover:bg-gray-700 whitespace-nowrap"
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
          query={query}
          selected={selected}
          onSelect={(field, value) => {
            setSelected((prev) => {
              const exists = prev.some(
                f => f.field === field && f.value === value
              );

              if (exists) return prev;

              return [
                ...prev,
                { field, value, op: "eq" as const },
              ];
            });
          }}
        />
      )}
    </div>
  );
}