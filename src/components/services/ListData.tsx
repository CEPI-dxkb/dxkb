'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, usePathname } from "next/navigation";
import { DataTable } from '@/components/containers/DataTable';
import { SortingState, RowSelectionState } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';

interface ListDataProps { 
  q: string; 
  resource: string; // 'genome', 'gene', etc. 
  onSelectionChange?: (rows: any[]) => void; 
//  onRowsSelected?: (rows: any[]) => void;
  }

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ListData({q, resource, onSelectionChange }: ListDataProps) {
  const [fields, setFields] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});


  useEffect(() => {
    (async () => {
      const mod = await import(`@/constants/datafields/${resource}`);
      const fieldObj = mod[`${resource}Fields`];
      setFields(
        Object.values(fieldObj)
          .filter((f: any) => f.show_in_table !== false)
          .map((f: any) => ({ id: f.field, label: f.label, visible: !f.hidden }))
        );
      })();
    }, [resource]);

  const widget = {
    id: 'widget-1',
    columns: fields,
  };

  const searchParams = useSearchParams();
//  const q = searchParams.get('q') ?? '';

  console.log('Search params q:', q);

  const searchtype = searchParams.get('searchtype') ?? '';
  const pathname = usePathname();
  const cleanQ = q?.split('#')[0] ?? '';
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API!;
  const pageSize = 200;
  const listKey = `${resource}-${cleanQ}-${searchtype}`;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const vis: Record<string, boolean> = {};
    fields.forEach(f => {
      vis[f.id] = f.visible !== false;
    });
    vis['__select__'] = true; // always show checkbox column
    return vis;
  });
  const [pageIndex, setPageIndex] = useState(0);

  const setSortingAndResetPage = (newSorting: SortingState) => {
    setSorting(newSorting);
    setPageIndex(0);
  };


  useEffect(() => {
    if (fields.length) {
      setColumnOrder(['__select__', ...fields.map(f => f.id)]);
    }
  }, [fields]);

  useEffect(() => {
    if (!fields.length) return;

    setColumnVisibility((prev) => {
      const updated = { ...prev };
      fields.forEach(f => {
        if (!(f.id in updated)) {
          updated[f.id] = f.visible !== false;
        }
      });
      return updated;
    });
  }, [fields]);

  // Fetch metadata (numFound)
  const { data: metaData, isLoading: metaLoading, error: metaError, refetch: metaRefetch  } = useQuery({
    queryKey: ['genome-meta', resource, cleanQ, pathname, searchtype],
    queryFn: async () => {
      const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
      const res = await fetch(`${baseURL}&limit(1)`, {
        headers: { 
          'Accept': 'application/solr+json'
          }
      });
      if (!res.ok) throw new Error('Failed to fetch metadata');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

// Compute totalItems safely
const totalItems = metaData?.response?.numFound ?? 0;

// Fetch current page of data
const { data: pageData, isLoading: dataLoading, error: dataError } = useQuery({
  queryKey: [
    'genome-full',
    resource,
    cleanQ,
    pageIndex,    // must be here
    sorting,      // must be here
    pathname,
    searchtype
  ],
  queryFn: async () => {
    const total = metaData?.response?.numFound ?? 0;
    console.log('Total items from metadata:', total);

    if (total === 0) return [];

    console.log('Fetching data for page:', pageIndex, 'with pageSize:', pageSize);

    const sortParam = sorting[0] ? `${sorting[0].desc ? '-' : '+'}${sorting[0].id}` : null;

    const start = pageIndex * pageSize;
    const end = start + pageSize;

    const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
    const url = sortParam ? `${baseURL}&sort(${sortParam})` : baseURL;

    console.log('SORTING STATE:', sorting);
    console.log('REQUEST URL:', url);

    const res = await fetch(url, {
      headers: {
        'Content-type': 'application/rqlquery+x-www-form-urlencoded',
        'Accept': 'application/json',
        'Range': `items=${start}-${end}`,
        'X-Range': `items=${start}-${end}`,
        }
    });

    if (!res.ok) throw new Error('Failed to fetch genome data');
    return res.json();
  },
  enabled: totalItems > 0,
  keepPreviousData: true, // optional: avoids flicker
  staleTime: 0,
  refetchOnWindowFocus: false,
});

  if (metaLoading || dataLoading) return <div>Loading...</div>;
  if (metaError || dataError) {
    return (
      <div>
        Error: {(metaError || dataError)?.message}
        <br />
        Query: {JSON.stringify(q)}
      </div>
    );
  }

const handlePageChange = (newPage: number) => {
  console.log('handlePageChange called, newPage:', newPage);
  setPageIndex(newPage);
  setRowSelection({});
  setSelectedRows([]);
};

async function handleDownloadAll(format: 'csv' | 'txt', visibleColumns: string[] | null) {
  if (!totalItems) {
    console.warn('No totalItems available for download');
    return;
  }

  try {
    const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
    // Request all items from server (use totalItems — you said this works)
    const res = await fetch(baseURL, {
      headers: {
        'Content-type': 'application/rqlquery+x-www-form-urlencoded',
        'Accept': 'application/json',
        'Range': `items=0-${totalItems}`, // you said totalItems works in your API
        'X-Range': `items=0-${totalItems}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch all data: ${res.status} ${res.statusText}`);
    const allData = await res.json();

    // Normalize response: if API wraps results, try to detect an items array, otherwise assume it's the array
    const rowsArray: any[] = Array.isArray(allData) ? allData : (allData.items ?? allData.response ?? allData.rows ?? []);

    // Determine which columns to export
    const colsToExport = (visibleColumns && visibleColumns.length > 0)
      ? visibleColumns
      : fields.map((c) => c.id);

    // Build header labels based on fields mapping (fall back to id)
    const headers = colsToExport.map((id) => {
      const col = fields.find((c) => c.id === id);
      return col?.label ?? id;
    });

    // CSV/TXT separator
    const separator = format === 'csv' ? ',' : '\t';

    // Helper to escape CSV values
    const escapeValue = (val: any) => {
      if (val === undefined || val === null) return '';
      if (typeof val === 'string') {
        // remove newlines and properly escape quotes for CSV
        const cleaned = val.replace(/\r\n|\n|\r/g, ' ');
        return `"${cleaned.replace(/"/g, '""')}"`;
      }
      if (typeof val === 'object') {
        const s = JSON.stringify(val);
        const cleaned = s.replace(/\r\n|\n|\r/g, ' ');
        return `"${cleaned.replace(/"/g, '""')}"`;
      }
      return String(val);
    };

    // Build content rows
    const contentRows = rowsArray.map((row) =>
      colsToExport
        .map((colId) => {
          const val = row[colId];
          // if CSV, use escapeValue; if TXT, use tab-separated without double-quoting complex objects
          if (format === 'csv') return escapeValue(val);
          // for txt (tab-separated), stringify objects but keep tabs/newlines replaced
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val).replace(/\r\n|\n|\r/g, ' ');
          return String(val).replace(/\r\n|\n|\r/g, ' ');
        })
        .join(separator)
    );

    const content = [headers.join(separator), ...contentRows].join('\n');

    // download helper
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${resource}-all.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Download all failed:', err);
    alert('Failed to download all results. See console for details.');
  }
}

// Wait for fields to load before rendering the table
if (fields.length === 0) {
  return <div>Loading...</div>;
}

console.log('current pageIndex:', pageIndex);

  return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <DataTable
            id={widget.id}
            data={pageData ?? []}
            columns={widget.columns}
            rowSelection={rowSelection}
            onRowSelectionChange={(newSelection) => {
              setRowSelection(newSelection);
              const selectedRows = pageData.filter((row) => newSelection[row.genome_id]);
              setSelectedRows(selectedRows);
              onSelectionChange?.(selectedRows);
}}
            onSelectionChange={(rows) => {
                setSelectedRows(rows);
                onSelectionChange?.(rows);
              }}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            sorting={sorting}
            onSortingChange={setSortingAndResetPage}
            columnOrder={columnOrder}
            onColumnOrderChange={setColumnOrder}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            onDownloadAll={handleDownloadAll}
          />
        </div>
    </div>
  );
}

