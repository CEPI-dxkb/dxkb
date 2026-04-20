import { useEffect, useState, useRef } from 'react';
import { buildRql } from './filterUtils';
import { KeywordSearch } from './KeywordSearch';
import { SelectedFilters } from './SelectedFilters';
import { FacetPanel } from './FacetPanel';

type SelectedFilter = {
  field: string;
  value: string | [string, string];
  op: 'eq' | 'ne' | 'gt' | 'lt' | 'between';
};

type ColumnField = {
  id: string;
  label: string;
  visible: boolean;
  facet?: boolean;
  facet_hidden?: boolean; 
};

type FilterBarProps = {
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

  const rql = buildRql({ selected, keywords });


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

  const buildQuery = () => {
    const parts: string[] = [];

    // keywords
    if (keywords.length > 0) {
      const keywordParts = keywords.map(
        (k) => `keyword(${encodeURIComponent(k)})`
      );

      if (keywordParts.length === 1) {
        parts.push(keywordParts[0]);
      } else {
        parts.push(`and(${keywordParts.join(',')})`);
      }
    }

    // selected filters
    const byField: Record<string, string[]> = {};

    selected.forEach(({ field, value }) => {
      if (!byField[field]) byField[field] = [];
      byField[field].push(value);
    });

    Object.entries(byField).forEach(([field, values]) => {
      if (values.length === 1) {
        parts.push(`eq(${field},${encodeURIComponent(values[0])})`);
      } else {
        parts.push(
          `or(${values
            .map((v) => `eq(${field},${encodeURIComponent(v)})`)
            .join(',')})`
        );
      }
    });

    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];

    console.log(`FULL QRY IS: and(${parts.join(',')})`);
    return `and(${parts.join(',')})`;
  };

  // emit filter upward
  useEffect(() => {
    const rql = buildRql({ selected, keywords });
    onFilterChange?.(rql);
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1 p-1 text-sm mt-0 mb-2">
      
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-2">
        
        {/* LEFT SIDE */}
        <div className="flex flex-col gap-1 flex-1">
          <KeywordSearch
            value={keywords.join(' ')}
            onChange={(val) => setKeywords(val.split(' ').filter(Boolean))}
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
              <button
                onClick={() => setFacetMenuOpen((prev) => !prev)}
                className="text-xs px-2 py-1 border border-gray-400 rounded hover:bg-gray-700"
              >
                Facets ⚙
              </button>

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
          <button
            onClick={clearAll}
            disabled={selected.length === 0 && keywords.length === 0}
            className={`text-xs px-2 py-1 border rounded whitespace-nowrap ${
              selected.length === 0 && keywords.length === 0
                ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                : 'border-red-400 text-red-300 hover:bg-red-900'
            }`}          
          >
            Clear All Filters
          </button>

          {/* SHOW/HIDE FILTERS */}
          <button
            onClick={() => setShowFacets((prev) => !prev)}
            className="text-xs px-2 py-1 border border-gray-400 rounded hover:bg-gray-700 whitespace-nowrap"
          >
            {showFacets ? 'Hide Filters' : 'Show Filters'}
          </button>

        </div>
      </div>

      {/* FACET PANEL */}
      {showFacets && (
        <FacetPanel
          fields={activeFacetFields}
          resource={resource}
          query={query}
          onSelect={(field, value) => {
            setSelected((prev) => [
              ...prev,
              { field, value, op: 'eq' as const },
            ]);
          }}
        />
      )}
    </div>
  );
}