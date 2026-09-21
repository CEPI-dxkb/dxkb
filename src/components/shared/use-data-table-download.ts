import { useState } from "react";
import type { DataTableInstance, DataTableProps } from "./data-table";

export type DownloadFormat = "csv" | "txt";

interface UseDataTableDownloadOptions {
  table: DataTableInstance;
  resource: string;
  selectedIds?: string[];
  isAllPagesSelected: boolean;
  onDownloadAll?: DataTableProps["onDownloadAll"];
  onDownloadSelected?: DataTableProps["onDownloadSelected"];
  onlyVisibleColumns: boolean;
}

export function useDataTableDownload({
  table,
  resource,
  selectedIds,
  isAllPagesSelected,
  onDownloadAll,
  onDownloadSelected,
  onlyVisibleColumns,
}: UseDataTableDownloadOptions) {
  const [downloadingButton, setDownloadingButton] = useState<string | null>(
    null,
  );

  const handleDownload = (format: DownloadFormat, onlySelected = false) => {
    setDownloadingButton(`${format}-${onlySelected ? "selected" : "all"}`);
    return downloadDataTable({
      table,
      resource,
      selectedIds,
      isAllPagesSelected,
      onDownloadAll,
      onDownloadSelected,
      onlyVisibleColumns,
      format,
      onlySelected,
    })
      .catch((error: unknown) => {
        console.error("Download failed:", error);
      })
      .finally(() => {
        setDownloadingButton(null);
      });
  };

  return { downloadingButton, handleDownload };
}

async function downloadDataTable({
  table,
  resource,
  selectedIds,
  isAllPagesSelected,
  onDownloadAll,
  onDownloadSelected,
  onlyVisibleColumns,
  format,
  onlySelected,
}: UseDataTableDownloadOptions & {
  format: DownloadFormat;
  onlySelected: boolean;
}) {
  const allColumns = table.getAllLeafColumns();
  const exportColumns = onlyVisibleColumns
    ? allColumns.filter(
        (column) => column.getIsVisible() && column.id !== "__select__",
      )
    : allColumns.filter((column) => column.id !== "__select__");
  const columnIds = exportColumns.map((column) => column.id);
  const selectedColumns = onlyVisibleColumns ? columnIds : null;

  if (onlySelected && isAllPagesSelected && onDownloadAll) {
    await onDownloadAll(format, selectedColumns);
    return;
  }
  if (!onlySelected && onDownloadAll) {
    await onDownloadAll(format, selectedColumns);
    return;
  }
  if (onlySelected) {
    if (!isAllPagesSelected && (!selectedIds || selectedIds.length === 0))
      return;
    await onDownloadSelected?.(format, selectedIds ?? [], selectedColumns);
    return;
  }

  const headers = exportColumns.map(
    (column) => column.columnDef.header as string,
  );
  const rows = table.getPrePaginatedRowModel().rows;
  const content = [
    headers.join(","),
    ...rows.map((row) =>
      exportColumns
        .map((column) => csvExportValue(row.getValue<unknown>(column.id)))
        .join(","),
    ),
  ].join("\n");
  downloadFile(`${resource}.${format}`, content);
}

function csvExportValue(value: unknown): string {
  if (value == null) return "";
  const quoted = typeof value === "string" || typeof value === "object";
  let serialized: string;
  if (typeof value === "string") serialized = value;
  else if (typeof value === "object") serialized = JSON.stringify(value);
  else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    serialized = String(value);
  else return "";

  const cleaned = serialized.replace(/\r\n|\n|\r/g, " ");
  const safe = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return quoted ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
