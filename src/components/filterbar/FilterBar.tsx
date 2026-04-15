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
};

type FilterBarProps = {
  fields: ColumnField[];
  onFilterChange: (rql: string) => void;
  className?: string;
  resource: string;
  query?: string;
};

export function FilterBar({ fields, onFilterChange, className, resource, query }: FilterBarProps) {
  
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedFilter[]>([]);

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

    return `and(${parts.join(',')})`;
  };

  // emit filter upward
  useEffect(() => {
    const rql = buildRql({ selected, keywords });
    onFilterChange?.(rql);
  }, [selected, keywords]);

  return (
    <div className={`flex flex-col gap-2 p-2 border rounded border-white ${className}`}>
      
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
  );
}