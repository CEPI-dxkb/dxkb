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
  /**
   * The rows currently on screen — already keyword-filtered by the caller in
   * loaded mode. An all-rows export in loaded mode serializes exactly these,
   * because `total` counts the unfiltered collection (the caller strips the
   * keyword from the server request) and `exportAll` is capped at
   * `maxExportRows`: refetching would both refuse small filtered exports and,
   * once the cap is reached, draw matches only from the first page of results.
   */
  displayedRows: readonly DataTableRow[];
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
  displayedRows,
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
    // Loaded mode exports the rows already on screen, so neither the refresh
    // guard nor the size guard applies: both speak for a refetch that no longer
    // happens, and `total` is the unfiltered collection total, which would
    // refuse a handful of visible matches inside a large result set.
    const exportsLoadedRows = hasLoadedKeyword && !ids?.length;
    if (!ids && isRefreshing && !exportsLoadedRows) {
      setExportError(
        "Wait for the current results to finish loading before exporting.",
      );
      return;
    }
    if (!ids?.length && !exportsLoadedRows && total > maxExportRows) {
      setExportError(
        `This export matches ${total.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
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
      } else if (exportsLoadedRows) {
        exportedRows = displayedRows;
      } else {
        exportedRows = (
          await repository.exportAll(resource, {
            rql,
            keyword,
            keywordMode,
            fields: selectedFields,
            sort,
          })
        ).rows;
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
