"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parse } from "csv-parse/sync";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Spinner } from "@/components/ui/spinner";
import { getProxyUrl, previewMaxBytes } from "../file-viewer-registry";
import { CodeMirrorViewer } from "./codemirror-viewer";

interface CsvViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
}

export function CsvViewer({ filePath, fileName, fileSize }: CsvViewerProps) {
  if (fileSize && fileSize > previewMaxBytes) {
    return (
      <CodeMirrorViewer
        filePath={filePath}
        fileName={fileName}
        fileSize={fileSize}
      />
    );
  }

  return <InteractiveCsvViewer filePath={filePath} fileName={fileName} />;
}

const rowHeight = 33;

function InteractiveCsvViewer({
  filePath,
  fileName,
}: {
  filePath: string;
  fileName: string;
}) {
  "use no memo";
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filePath]);

  const { records, columnNames, parseError } = useMemo(() => {
    if (!content) return { records: [], columnNames: [], parseError: null };

    try {
      const delimiter = fileName.endsWith(".tsv") ? "\t" : ",";
      const parsed = parse(content, {
        delimiter,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      const names =
        parsed.length > 0
          ? Object.keys(parsed[0] as Record<string, string>)
          : [];

      return { records: parsed, columnNames: names, parseError: null };
    } catch (err) {
      return {
        records: [],
        columnNames: [],
        parseError:
          err instanceof Error ? err.message : "Failed to parse CSV/TSV",
      };
    }
  }, [content, fileName]);

  const displayError = error || parseError;

  const columns = useMemo<ColumnDef<Record<string, string>>[]>(() => {
    return columnNames.map((col) => ({
      accessorKey: col,
      header: col,
      cell: (info) => info.getValue(),
    }));
  }, [columnNames]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable API is inherently incompatible with React Compiler; component is already opted out via "use no memo"
  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
  });

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground">
        Loading... <Spinner />
      </div>
    );
  }

  if (displayError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-destructive">
        {displayError}
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
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-auto"
      >
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0 z-10">
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
            {virtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0, padding: 0, border: "none" }}
                />
              </tr>
            )}
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="border-b border-border/50 hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-1.5 whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {virtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    height:
                      virtualizer.getTotalSize() -
                      (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                    padding: 0,
                    border: "none",
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
