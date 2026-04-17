import { useEffect, useState } from 'react';
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
  
  console.log('QRY in FilterBar is:', query);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedFilter[]>([]);
  const [showFacets, setShowFacets] = useState(false);
  const rql = buildRql({ selected, keywords });

console.log('RQL OUTPUT:', rql, typeof rql);

const activeFacetFields = facetFields?.filter(
    (f) => f.facet && !f.facet_hidden
  ) ?? [];

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

  
  return (
    <div className="flex flex-col gap-1 p-1 text-sm border rounded border-white mt-0 mb-2">
      
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

        {/* RIGHT SIDE — TOGGLE */}
        <button
          onClick={() => setShowFacets((prev) => !prev)}
          className="text-xs px-2 py-1 border border-gray-400 rounded hover:bg-gray-700 whitespace-nowrap"
        >
          {showFacets ? 'Hide Filters' : 'Show Filters'}
        </button>
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