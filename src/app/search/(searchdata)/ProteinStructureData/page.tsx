'use client';

import React, { useState } from 'react';
import { useSearchParams } from "next/navigation";
import { DataTable } from '@/components/containers/DataTable';
import { SortingState } from '@tanstack/react-table';
import { proteinstructureFields } from '@/constants/datafields/proteinstructures';
import { useQuery } from '@tanstack/react-query';

interface GenomeDataProps {
  onSelectionChange?: (rows: any[]) => void;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ProteinStructureData({ onSelectionChange }: GenomeDataProps) {
  const genomeColumns = Object.values(proteinstructureFields)
    .filter((obj: any) => obj.show_in_table !== false)
    .map(obj => ({
      id: obj.field,
      label: obj.label,
      visible: !obj.hidden,
    }));

  const widget = {
    id: 'widget-1',
    columns: genomeColumns,
  };

  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  const cleanQ = q?.split('#')[0] ?? '';
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API!;
  const baseURL = `${DataAPI}/protein_structure/?${cleanQ}`;
  const pageSize = 200;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [pageIndex, setPageIndex] = useState(0);

  const setSortingAndResetPage = (newSorting: SortingState) => {
    setSorting(newSorting);
    setPageIndex(0);
  };

  // Fetch metadata (numFound)
  const { data: metaData, isLoading: metaLoading, error: metaError } = useQuery({
    queryKey: ['genome-meta', baseURL],
    queryFn: async () => {
      const res = await fetch(`${baseURL}&limit(1)`, {
        headers: { 'Accept': 'application/solr+json' },
      });
      if (!res.ok) throw new Error('Failed to fetch metadata');
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const totalItems = metaData?.response?.numFound ?? 0;

  // Fetch current page of data
  const {
    data: pageData,
    isLoading: dataLoading,
    error: dataError,
  } = useQuery({
    queryKey: ['genome-full', baseURL, totalItems, sorting, pageIndex],
    queryFn: async () => {
      if (!totalItems) return [];

      const sortParam = sorting[0]
        ? `${sorting[0].desc ? '-' : '+'}${sorting[0].id}`
        : null;

      const url = sortParam ? `${baseURL}&sort(${sortParam})` : baseURL;

      const start = pageIndex * pageSize;
      const end = start + pageSize;

      console.log('start, end', start, end);
      
      const res = await fetch(url, {
        headers: {
          'Content-type': 'application/rqlquery+x-www-form-urlencoded',
          'Accept': 'application/json',
          'Range': `items=${start}-${end}`,
          'X-Range': `items=${start}-${end}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch genome data');
      return res.json();
    },
    enabled: !!totalItems,
    staleTime: 1000 * 60 * 10,
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

async function handleDownloadAll(format: 'csv' | 'txt', visibleColumns: string[] | null) {
  if (!totalItems) {
    console.warn('No totalItems available for download');
    return;
  }

  try {
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
    // If visibleColumns is provided and non-empty -> use it, otherwise use the full genomeColumns list
    const colsToExport = (visibleColumns && visibleColumns.length > 0)
      ? visibleColumns
      : genomeColumns.map((c) => c.id);

    // Build header labels based on genomeColumns mapping (fall back to id)
    const headers = colsToExport.map((id) => {
      const col = genomeColumns.find((c) => c.id === id);
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
    link.download = `genomes-all.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Download all failed:', err);
    alert('Failed to download all results. See console for details.');
  }
}

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DataTable
          id={widget.id}
          data={pageData ?? []}
          columns={widget.columns}
          onSelectionChange={onSelectionChange}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={(newPage) => {
            onSelectionChange?.([]);     // ← CLEAR SELECTION
            setPageIndex(newPage);
          }}
          sorting={sorting}
          onSortingChange={(newSorting) => {
            onSelectionChange?.([]);     // ← CLEAR SELECTION
            setSortingAndResetPage(newSorting);
          }}
          onDownloadAll={handleDownloadAll}
        />

      </div>
    </div>
  );
}
export default ProteinStructureData;
