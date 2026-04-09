'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { SortingState, RowSelectionState } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { noop } from "@/lib/utils";

interface ColumnInfo {
  id: string;
  label: string;
  visible: boolean;
}

interface ListDataProps { 
  q: string; 
  resource: string; // 'genome', 'gene', etc.
  onSelectionChange?: (rows: unknown[]) => void;
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: (selection: Record<string, boolean>) => void;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
}

export function ListData({ q, resource, onSelectionChange, rowSelection: controlledRowSelection, onRowSelectionChange, pageIndex: controlledPageIndex, onPageChange }: ListDataProps) {
  const [fields, setFields] = useState<ColumnInfo[]>([]);
  
  // Use controlled rowSelection if provided, otherwise use internal state
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const rowSelection = controlledRowSelection !== undefined ? controlledRowSelection : internalRowSelection;
  const setRowSelection = onRowSelectionChange || setInternalRowSelection;
  
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
          (Object.values(fieldObj) as Record<string, unknown>[])
            .filter((f) => f.show_in_table !== false)
            .map((f) => ({
              id: String(f.field ?? ""),
              label: String(f.label ?? ""),
              visible: !f.hidden,
            }))
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
  const searchtype = searchParams.get('searchtype') ?? '';
  const cleanQ = q?.split('#')[0] ?? '';
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;
  if (!DataAPI) {
    throw new Error('NEXT_PUBLIC_DATA_API environment variable is not configured');
  }
  const pageSize = 200;

  // Reset sorting when resource/query actually changes
  const prevResourceRef = useRef(resource);
  const prevCleanQRef = useRef(cleanQ);
  
  useEffect(() => {
    const resourceChanged = prevResourceRef.current !== resource;
    const queryChanged = prevCleanQRef.current !== cleanQ;
    
    if (resourceChanged || queryChanged) {
      setSorting([]);
      setRowSelection({});
      onSelectionChange?.([]);
      prevResourceRef.current = resource;
      prevCleanQRef.current = cleanQ;
    }
  }, [resource, cleanQ, onSelectionChange, setRowSelection]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const pageIndex = controlledPageIndex !== undefined ? controlledPageIndex : internalPageIndex;
  const setPageIndex = onPageChange || setInternalPageIndex;

  const setSortingAndResetPage = useCallback((newSorting: SortingState) => {
    setSorting(newSorting);
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
    return sorting.length > 0
      ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`
      : 'none';
  }, [sorting]);

  // Fetch metadata (numFound)
  const { data: metaData, isLoading: metaLoading, error: metaError } = useQuery({
    queryKey: ['genome-meta', resource, cleanQ, searchtype],
    queryFn: async () => {
      const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
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
  const { data: pageData, isLoading: dataLoading, error: dataError, isFetching: dataFetching } = useQuery({
    queryKey: [
      'genome-full',
      resource,
      cleanQ,
      pageIndex,
      sortingKey,
      searchtype,
      totalItems,
    ],
    queryFn: async () => {
      if (totalItems === 0) return [];

      // Derive sort param from sortingKey (already in queryKey) to avoid stale closure
      const sortParam = sortingKey !== "none"
        ? (() => { const [field, dir] = sortingKey.split(":"); return `${dir === "desc" ? "-" : "+"}${field}`; })()
        : null;
      const start = pageIndex * pageSize;
      const end = start + pageSize;

      const baseURL = `${DataAPI}/${resource}/?${cleanQ}`;
      const url = sortParam ? `${baseURL}&sort(${sortParam})` : baseURL;

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
      return data;
    },
    enabled: totalItems > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
  });

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

      const rowsArray: unknown[] = Array.isArray(allData) ? allData : (allData.items ?? allData.response ?? allData.rows ?? []);
      const colsToExport = (visibleColumns && visibleColumns.length > 0)
        ? visibleColumns
        : fields.map((c) => c.id);

      const headers = colsToExport.map((id) => {
        const col = fields.find((c) => c.id === id);
        return col?.label ?? id;
      });

      const separator = format === 'csv' ? ',' : '\t';

      const escapeValue = (val: unknown) => {
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

      const contentRows = rowsArray.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return colsToExport
          .map((colId) => {
            const val = r[colId];
            if (format === 'csv') return escapeValue(val);
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val).replace(/\r\n|\n|\r/g, ' ');
            return String(val).replace(/\r\n|\n|\r/g, ' ');
          })
          .join(separator);
      });

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
            onSelectionChange={noop}
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
            isLoading={metaLoading || dataLoading || dataFetching}
          />
        )}
      </div>
    </div>
  );
}