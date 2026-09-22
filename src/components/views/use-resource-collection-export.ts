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

export function matchesLoadedKeyword(row: DataTableRow, keyword: string) {
  return Object.values(row).some((value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) =>
      String(item ?? "")
        .toLowerCase()
        .includes(keyword),
    );
  });
}

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
  loadedKeyword: string;
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
  loadedKeyword,
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
        hasLoadedKeyword
          ? `This export must search ${total.toLocaleString()} rows. Narrow the source results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`
          : `This export matches ${total.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
      );
      return;
    }

    try {
      const selectedFields = fields
        ? [...fields]
        : columns.map((column) => column.id);
      let exportedRows: readonly DataTableRow[];
      if (ids?.length) {
        exportedRows = await fetchSelectedRows(
          repository,
          resource,
          idField,
          ids,
          selectedFields,
        );
      } else {
        const requestFields = hasLoadedKeyword
          ? columns.map((column) => column.id)
          : selectedFields;
        const rows = (
          await repository.exportAll(resource, {
            rql,
            keyword: hasLoadedKeyword ? undefined : keyword,
            keywordMode: hasLoadedKeyword ? undefined : keywordMode,
            fields: requestFields,
            sort,
          })
        ).rows;
        const normalizedLoadedKeyword = loadedKeyword.trim().toLowerCase();
        exportedRows = hasLoadedKeyword
          ? rows.filter((row) =>
              matchesLoadedKeyword(row, normalizedLoadedKeyword),
            )
          : rows;
      }
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
