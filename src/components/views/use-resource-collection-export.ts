"use client";

import { useState } from "react";
import type {
  DataTableColumn,
  DataTableRow,
} from "@/components/shared/data-table";
import {
  maxExportRows,
  type DataRepository,
  type DataResource,
  type DataSort,
} from "@/lib/data-api";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { downloadResourceExport } from "./resource-export";
import { fetchSelectedRows } from "./use-resource-collection-row-resolution";

const genericExportErrorMessage =
  "The requested export could not be created. Please try again.";

type ExportFormat = "csv" | "txt";

interface UseResourceCollectionExportOptions {
  repository: DataRepository;
  resource: DataResource;
  idField: string;
  columns: readonly DataTableColumn[];
  exportFileName?: string;
  total: number;
  isRefreshing: boolean;
  hasLoadedKeyword: boolean;
  normalizedLoadedKeyword: string;
  matchesLoadedKeyword: (row: DataTableRow, keyword: string) => boolean;
  rql?: string;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
  sort?: DataSort;
}

export function useResourceCollectionExport({
  repository,
  resource,
  idField,
  columns,
  exportFileName,
  total,
  isRefreshing,
  hasLoadedKeyword,
  normalizedLoadedKeyword,
  matchesLoadedKeyword,
  rql,
  keyword,
  keywordMode,
  sort,
}: UseResourceCollectionExportOptions) {
  const [exportError, setExportError] = useState<string | null>(null);

  const exportRows = async (
    format: ExportFormat,
    selectedIds?: readonly string[],
    fields: readonly string[] | null = null,
    isAllPagesSelected = false,
  ) => {
    setExportError(null);
    const ids = isAllPagesSelected ? undefined : selectedIds;
    if (ids && ids.length === 0) return;
    if (!ids && isRefreshing) {
      setExportError(
        "Wait for the current results to finish loading before exporting.",
      );
      return;
    }
    if (!ids?.length && total > maxExportRows) {
      setExportError(
        `This export matches ${total.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
      );
      return;
    }

    try {
      const selectedFields = fields
        ? [...fields]
        : columns.map((column) => column.id);
      const allFields = columns.map((column) => column.id);
      const rows = ids?.length
        ? await fetchSelectedRows(
            repository,
            resource,
            idField,
            ids,
            selectedFields,
          )
        : (
            await repository.exportAll(resource, {
              rql,
              keyword,
              keywordMode,
              fields: hasLoadedKeyword ? allFields : selectedFields,
              sort,
            })
          ).rows;
      const exportedRows =
        hasLoadedKeyword && !ids
          ? rows.filter((row) =>
              matchesLoadedKeyword(row, normalizedLoadedKeyword),
            )
          : rows;
      downloadResourceExport(
        resource,
        exportedRows,
        columns,
        selectedFields,
        format,
        "all",
        exportFileName ?? resource,
      );
    } catch (error) {
      console.error("Resource export failed:", error);
      setExportError(
        formatUserFacingErrorMessage(error, genericExportErrorMessage),
      );
    }
  };

  return { exportError, exportRows };
}
