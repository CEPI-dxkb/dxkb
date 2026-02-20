'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { DataTable } from "@/components/containers/DataTable";
import { SortingState, RowSelectionState } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

interface ListDataProps { 
  q: string; 
  resource: string; // 'genome', 'gene', etc.
  onSelectionChange?: (rows: any[]) => void;
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: (selection: Record<string, boolean>) => void;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ListData({ q, resource, onSelectionChange, rowSelection: controlledRowSelection, onRowSelectionChange, pageIndex: controlledPageIndex, onPageChange }: ListDataProps) {
  const [fields, setFields] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  
  // Use controlled rowSelection if provided, otherwise use internal state
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const rowSelection = controlledRowSelection !== undefined ? controlledRowSelection : internalRowSelection;
  const setRowSelection = onRowSelectionChange || setInternalRowSelection;
  
  // Track if we're in the middle of a page transition
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const mod = await import(`@/constants/datafields/${resource}`);
        const fieldObj = mod[`${resource}Fields`];
        if (!fieldObj) {
          console.error(`No fields definition found for resource: ${resource}`);
          return;
        }
        setFields(
          Object.values(fieldObj)
            .filter((f: any) => f.show_in_table !== false)
            .map((f: any) => ({ id: f.field, label: f.label, visible: !f.hidden }))
        );
      } catch (err) {
        console.error(`Failed to load fields for resource "${resource}":`, err);
      }
    })();
  }, [resource]);

  const widget = {
    id: 'widget-1',
    columns: fields,
  };

  const searchParams = useSearchParams();
  // const q = searchParams.get('q') ?? '';
  console.log('Search params q:', q);

  const searchtype = searchParams.get('searchtype') ?? '';
  const pathname = usePathname();
  const cleanQ = q?.split('#')[0] ?? '';
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;
  if (!DataAPI) {
    throw new Error('NEXT_PUBLIC_DATA_API environment variable is not configured');
  }
  const pageSize = 200;
  const listKey = `${resource}-${cleanQ}-${searchtype}`;

  // Reset sorting when resource/query actually changes
  const prevResourceRef = useRef(resource);
  const prevCleanQRef = useRef(cleanQ);
  
  useEffect(() => {
    const resourceChanged = prevResourceRef.current !== resource;
    const queryChanged = prevCleanQRef.current !== cleanQ;
    
    if (resourceChanged || queryChanged) {
      console.log('Resource or query changed, resetting sorting and selection');
      setSorting([]);
      setRowSelection({});
      onSelectionChange?.([]);
      prevResourceRef.current = resource;
      prevCleanQRef.current = cleanQ;
    }
  }, [resource, cleanQ, onSelectionChange]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const pageIndex = controlledPageIndex !== undefined ? controlledPageIndex : internalPageIndex;
  const setPageIndex = onPageChange || setInternalPageIndex;

  const setSortingAndResetPage = useCallback((newSorting: SortingState) => {
    console.log('🔵 setSortingAndResetPage called with:', JSON.stringify(newSorting));
    setSorting(newSorting);
    console.log('🔵 setSorting called (async state update scheduled)');
    setPageIndex(0);
    setRowSelection({});
    onSelectionChange?.([]); // Clear selection in parent too
  }, [onSelectionChange, setPageIndex, setRowSelection]);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!fields.length || columnVisibility !== null) return;
    const vis: Record<string, boolean> = { __select__: true };
    fields.forEach(f => {
      vis[f.id] = f.visible !== false;
    });
    setColumnVisibility(vis);
  }, [fields, columnVisibility]);

  useEffect(() => {
    if (fields.length) {
      setColumnOrder(['__select__', ...fields.map(f => f.id)]);
    }
  }, [fields]);

  // Compute sortingKey from state using useMemo
  const sortingKey = useMemo(() => {
    const key = sorting.length > 0
      ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`
      : 'none';
    console.log('🟣 sortingKey recomputed:', key, 'sorting:', JSON.stringify(sorting));
    return key;
  }, [sorting]);

  // Fetch metadata (numFound)
  const { data: metaData, isLoading: metaLoading, error: metaError, refetch: metaRefetch } = useQuery({
    queryKey: ['genome-meta', resource, cleanQ, searchtype],
    queryFn: async () => {
      const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
      console.log('Fetching metadata from URL:', baseURL);
      const res = await fetch(`${baseURL}&limit(1)`, {
        headers: { 'Accept': 'application/solr+json' }
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
  const { data: pageData, isLoading: dataLoading, error: dataError, refetch, isFetching: dataFetching } = useQuery({
    queryKey: [
      'genome-full',
      resource,
      cleanQ,
      pageIndex,
      sortingKey,
      searchtype
    ],
    queryFn: async () => {
      const total = metaData?.response?.numFound ?? 0;
      console.log('Total items from metadata:', total);
      if (total === 0) return [];
      console.log('Fetching data for page:', pageIndex, 'with pageSize:', pageSize);

      // Use sorting state from query key (not ref)
      const currentSorting = sorting;
      console.log('🟠 QueryFn: sorting array:', JSON.stringify(currentSorting));
      const sortParam = currentSorting[0] ? `${currentSorting[0].desc ? '-' : '+'}${currentSorting[0].id}` : null;
      console.log('🟠 QueryFn: sortParam:', sortParam);
      const start = pageIndex * pageSize;
      const end = start + pageSize;

      const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
      const url = sortParam ? `${baseURL}&sort(${sortParam})` : baseURL;

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
      const data = await res.json();
      
      // Clear transitioning state when data is fetched
      setIsPageTransitioning(false);
      
      return data;
    },
    enabled: totalItems > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Log sorting state changes for debugging
  useEffect(() => {
    console.log('🟢 Sorting state changed to:', JSON.stringify(sorting));
  }, [sorting]);
  
  // Clear transitioning state if there's an error
  useEffect(() => {
    if (dataError) {
      setIsPageTransitioning(false);
    }
  }, [dataError]);

  if (metaError || dataError) {
    return (
      <div>
        Error: {(metaError || dataError)?.message}
        <br />
        Query: {JSON.stringify(q)}
      </div>
    );
  }

  const handleRowSelectionChange = (newSelection: Record<string, boolean>) => {
    setRowSelection(newSelection);
    
    // Convert to selected rows array and notify parent
    const selectedRowsData = Object.keys(newSelection)
      .filter(k => newSelection[k])
      .map((key) => (pageData ?? [])[parseInt(key, 10)])
      .filter(Boolean);
    
    onSelectionChange?.(selectedRowsData);
  };

  const handlePageChange = (newPage: number) => {
    console.log('handlePageChange called, newPage:', newPage);
    // Set transitioning state
    setIsPageTransitioning(true);
    // Clear selections when page changes
    setRowSelection({});
    onSelectionChange?.([]); // Clear selection in parent too
    // Update page index (this will call parent's setPageIndex if controlled)
    setPageIndex(newPage);
  };

  async function handleDownloadAll(format: 'csv' | 'txt', visibleColumns: string[] | null) {
    if (!totalItems) {
      console.warn('No totalItems available for download');
      return;
    }
    try {
      const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
      const res = await fetch(baseURL, {
        headers: {
          'Content-type': 'application/rqlquery+x-www-form-urlencoded',
          'Accept': 'application/json',
          'Range': `items=0-${totalItems}`,
          'X-Range': `items=0-${totalItems}`,
        },
      });
      if (!res.ok) throw new Error(`Failed to fetch all data: ${res.status} ${res.statusText}`);
      const allData = await res.json();

      const rowsArray: any[] = Array.isArray(allData) ? allData : (allData.items ?? allData.response ?? allData.rows ?? []);
      const colsToExport = (visibleColumns && visibleColumns.length > 0)
        ? visibleColumns
        : fields.map((c) => c.id);

      const headers = colsToExport.map((id) => {
        const col = fields.find((c) => c.id === id);
        return col?.label ?? id;
      });

      const separator = format === 'csv' ? ',' : '\t';

      const escapeValue = (val: any) => {
        if (val === undefined || val === null) return '';
        if (typeof val === 'string') {
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

      const contentRows = rowsArray.map((row) =>
        colsToExport
          .map((colId) => {
            const val = row[colId];
            if (format === 'csv') return escapeValue(val);
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val).replace(/\r\n|\n|\r/g, ' ');
            return String(val).replace(/\r\n|\n|\r/g, ' ');
          })
          .join(separator)
      );

      const content = [headers.join(separator), ...contentRows].join('\n');

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

  if (fields.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {!columnVisibility || !fields.length ? (
          <div>Loading...</div>
        ) : (
          <DataTable
            id={widget.id}
            data={pageData ?? []}
            columns={widget.columns}
            resource={resource}
            rowSelection={rowSelection}
            onRowSelectionChange={handleRowSelectionChange}
            onSelectionChange={(selectedRows) => {
              // Backwards compatibility callback - logs for debugging
              console.log('Selected rows:', selectedRows.length);
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
            isLoading={metaLoading || dataLoading || isPageTransitioning || dataFetching}
          />
        )}
      </div>
    </div>
  );
}