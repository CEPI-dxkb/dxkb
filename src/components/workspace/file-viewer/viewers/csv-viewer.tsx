"use client";

import { useEffect, useMemo, useState } from "react";
import { parse } from "csv-parse/sync";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";

import { getProxyUrl } from "../file-viewer-registry";

interface CsvViewerProps {
  filePath: string;
  fileName: string;
}

export function CsvViewer({ filePath, fileName }: CsvViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setContent(null);

    fetch(getProxyUrl(filePath), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
        return res.text();
      })
      .then((text) => setContent(text))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filePath]);

  const { records, columnNames } = useMemo(() => {
    if (!content) return { records: [], columnNames: [] };

    try {
      const delimiter = fileName.endsWith(".tsv") ? "\t" : ",";
      const parsed = parse(content, {
        delimiter,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      const names =
        parsed.length > 0 ? Object.keys(parsed[0] as Record<string, string>) : [];

      return { records: parsed, columnNames: names };
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse CSV/TSV",
      );
      return { records: [], columnNames: [] };
    }
  }, [content, fileName]);

  const columns = useMemo<ColumnDef<Record<string, string>>[]>(() => {
    return columnNames.map((col) => ({
      accessorKey: col,
      header: col,
      cell: (info) => info.getValue(),
    }));
  }, [columnNames]);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        No data found
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        {records.length} rows · {columnNames.length} columns
      </div>
      <div className="h-full w-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none border-b border-border px-3 py-2 text-left font-medium"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc"
                      ? " ↑"
                      : header.column.getIsSorted() === "desc"
                        ? " ↓"
                        : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-1.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
