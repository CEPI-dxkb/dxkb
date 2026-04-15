'use client';

import { useEffect, useState } from 'react';
import { FacetColumn } from './FacetColumn';

type FacetItem = {
  label: string;
  value: string;
  count: number;
};

type ColumnField = {
  id: string;
  label: string;
};

type FacetPanelProps = {
  fields: ColumnField[];
  query: string;
  resource: string;
  onSelect: (field: string, value: string) => void;
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
}: FacetPanelProps) {
  const [facets, setFacets] = useState<Record<string, FacetItem[]>>({});

  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;

  console.log("QRY is:", query);

  useEffect(() => {
    // ---------------------------------------------------
    // HARD GUARDS (THIS FIXES YOUR CURRENT ERROR)
    // ---------------------------------------------------
    if (!DataAPI) return;
    if (!resource) return;
    if (!fields || fields.length === 0) {
      console.warn('FacetPanel: fields not ready yet — skipping fetch');
      return;
    }

    const fetchFacets = async () => {
      try {

        // ---------------------------------------------------
        // EXTRACT VALID FIELDS
        // ---------------------------------------------------
        const validFields = fields
          .filter((f): f is ColumnField =>
            f &&
            typeof f.id === 'string' &&
            f.id.trim().length > 0
          )
          .map(f => f.id);
          
        if (validFields.length === 0) {
          console.warn('FacetPanel: no valid facet fields', fields);
          return;
        }

        // ---------------------------------------------------
        // BUILD FACET STRING (DOJO-EQUIVALENT)
        // ---------------------------------------------------
        const facetFieldsStr = validFields.join(',');

        if (!facetFieldsStr) {
          console.warn('FacetPanel: facetFieldsStr empty');
          return;
        }

        const facetStr = `facet(${facetFieldsStr},(mincount,1),(limit,100))`;

        console.log('FacetPanel: built facetStr:', facetStr);
        // ---------------------------------------------------
        // BUILD URL SAFELY (NO FRAGILE CONCATENATION)
        // ---------------------------------------------------
        const rqlParts: string[] = [];

        console.log('FacetPanel: building RQL with query:', query);

        const safeQuery = (query || '')
          .split('&')
          .filter(Boolean)
          .filter(part => !part.startsWith('facet'))
          .filter(part => !part.startsWith('limit'))
          .join('&');

        if (safeQuery) {
          rqlParts.push(safeQuery);
        }

        rqlParts.push('limit(1)');
        rqlParts.push(facetStr);

        console.log('FacetPanel: final RQL parts:', rqlParts);
        const RQLstring = rqlParts.join('&');
        console.log('FacetPanel: final RQL string:', RQLstring);

        const url = `${DataAPI}/${resource}/?${RQLstring}`;

        console.log('FACET URL:', url);

        console.log('FACET DEBUG STATE:', {
          fields,
          validFields,
          facetFieldsStr: validFields.join(','),
          query,
          resource,
        });


        // ---------------------------------------------------
        // FETCH
        // ---------------------------------------------------
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/solr+json',
          },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('Facet error response:', text);
          throw new Error('Failed to fetch facets');
        }

        const json = await res.json();

        // ---------------------------------------------------
        // PARSE RESPONSE
        // ---------------------------------------------------
        const parsed = parseFacetCounts(
          json?.facet_counts?.facet_fields || {}
        );

        setFacets(parsed);
      } catch (err) {
        console.error('Facet fetch error:', err);
      }
    };

    fetchFacets();
  }, [fields, query, resource, DataAPI]);

  return (
    <div className="flex gap-4 overflow-x-auto bg-gray-800 p-2 rounded">
      {fields.map((field) => (
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