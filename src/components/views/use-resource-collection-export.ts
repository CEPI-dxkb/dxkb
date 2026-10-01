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
import {
  exceedsReadLimit,
  fetchSelectedRows,
  readAllMatchingRows,
} from "./use-resource-collection-row-resolution";

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
  /**
   * The rows and total on screen belong to a previous query while this one
   * loads, so an all-matching read would be sized by the wrong total. A
   * background refresh of the same query is not this; its total is this
   * query's latest count, and `exceedsReadLimit` checks the read itself.
   */
  isPlaceholderData: boolean;
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
  isPlaceholderData,
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
    if (!ids && isPlaceholderData) {
      setExportError(
        "Wait for the current results to finish loading before exporting.",
      );
      return;
    }
    const limitMessage = (rowCount: string) =>
      hasLoadedKeyword
        ? `This export must search ${rowCount} rows. Narrow the source results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`
        : `This export matches ${rowCount} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`;
    if (!ids?.length && total > maxExportRows) {
      setExportError(limitMessage(total.toLocaleString()));
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
        const read = await readAllMatchingRows(repository, resource, idField, {
          rql,
          keyword: hasLoadedKeyword ? undefined : keyword,
          keywordMode: hasLoadedKeyword ? undefined : keywordMode,
          fields: requestFields,
          sort,
        });
        if (exceedsReadLimit(read, maxExportRows)) {
          setExportError(limitMessage(read.total.toLocaleString()));
          return;
        }
        const { rows } = read;
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
