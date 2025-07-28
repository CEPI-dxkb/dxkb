'use client';

import React, { useState } from 'react';
import { useSearchParams } from "next/navigation";
import { DataTable } from '@/components/containers/DataTable';
import { SortingState } from '@tanstack/react-table';
import { sequenceFields } from '@/constants/datafields/sequence';
import { useQuery } from '@tanstack/react-query';

interface GenomeDataProps {
  onSelectionChange?: (rows: any[]) => void;
}

export function SequenceData({ onSelectionChange }: GenomeDataProps) {
  const sequenceColumns = Object.values(sequenceFields).map(obj => ({
    id: obj.field,
    label: obj.label,
    visible: !obj.hidden,
  }));

  const widget = {
    id: 'widget-1',
    columns: sequenceColumns,
  };

  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  const cleanQ = q?.split('#')[0] ?? '';
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API!;
  const baseURL = `${DataAPI}/genome_sequence/?${cleanQ}`;
  const pageSize = 200;

  const [sorting, setSorting] = useState<SortingState>([]);

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
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const totalItems = metaData?.response?.numFound ?? 0;

  // Fetch full data using totalItems and sorting
  const {
    data: fullData,
    isLoading: dataLoading,
    error: dataError,
  } = useQuery({
    queryKey: ['genome-full', baseURL, totalItems, sorting],
    queryFn: async () => {
      if (!totalItems) return [];

      const sortParam = sorting[0]
        ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`
        : null;

      const url = sortParam ? `${baseURL}&sort(${sortParam})` : baseURL;

      const res = await fetch(url, {
        headers: {
          'Content-type': 'application/rqlquery+x-www-form-urlencoded',
          'Accept': 'application/json',
          'Range': `items=0-${totalItems}`,
          'X-Range': `items=0-${totalItems}`,
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <DataTable
          id={widget.id}
          data={fullData ?? []}
          columns={widget.columns}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </div>
  );  
}
