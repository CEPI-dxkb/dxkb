"use client";

import { downloadResourceExport } from "@/components/views/resource-export";
import {
  DataRepository,
  maxExportRows,
  type DataResource,
  type DataSort,
} from "@/lib/data-api";
import { maxSelectedRows } from "@/lib/data-api/validation";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { downloadLoadedResourceRows, type ColumnInfo } from "./list-data-utils";

const dataRepository = new DataRepository();

type ExportFormat = "csv" | "txt";

interface UseListDataExportOptions {
  resource: DataResource;
  fields: ColumnInfo[];
  idField: string;
  combinedQuery: string;
  sort: DataSort | undefined;
  totalItems: number;
  displayedRows: Record<string, unknown>[];
  hasLoadedKeyword: boolean;
}

export function getExportProjection(
  fields: ColumnInfo[],
  visibleColumns: string[] | null,
): string[] {
  const tableFields = fields.map((field) => field.id);
  const requested = (visibleColumns ?? tableFields).filter(
    (id) => id !== "__select__",
  );
  return requested.length ? requested : tableFields;
}

export function orderSelectedRows(
  rows: Record<string, unknown>[],
  ids: string[],
  idField: string,
): Record<string, unknown>[] {
  const orderById = new Map(ids.map((id, index) => [id, index]));
  return rows.sort(
    (a, b) =>
      (orderById.get(String(a[idField])) ?? Number.MAX_VALUE) -
      (orderById.get(String(b[idField])) ?? Number.MAX_VALUE),
  );
}

export function useListDataExport({
  resource,
  fields,
  idField,
  combinedQuery,
  sort,
  totalItems,
  displayedRows,
  hasLoadedKeyword,
}: UseListDataExportOptions) {
  const exportProjection = (visibleColumns: string[] | null) =>
    getExportProjection(fields, visibleColumns);

  async function handleDownloadAll(
    format: ExportFormat,
    visibleColumns: string[] | null,
  ): Promise<void> {
    const exportTotal = hasLoadedKeyword ? displayedRows.length : totalItems;
    if (!exportTotal) {
      console.warn("No results available for download");
      return;
    }

    if (!hasLoadedKeyword && exportTotal > maxExportRows) {
      alert(
        `This export matches ${exportTotal.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
      );
      return;
    }

    try {
      if (hasLoadedKeyword) {
        downloadLoadedResourceRows({
          resource,
          rows: displayedRows,
          format,
          visibleColumns,
          fields,
        });
        return;
      }
      const result = await dataRepository.exportAll(resource, {
        rql: combinedQuery || undefined,
        fields: exportProjection(visibleColumns),
        sort,
      });
      downloadLoadedResourceRows({
        resource,
        rows: result.rows,
        format,
        visibleColumns,
        fields,
      });
    } catch (error) {
      console.error("Download all failed:", error);
      alert(
        formatUserFacingErrorMessage(
          error,
          "Failed to download all results. See console for details.",
        ),
      );
    }
  }

  async function handleDownloadSelected(
    format: ExportFormat,
    ids: string[],
    visibleColumns: string[] | null,
  ): Promise<void> {
    if (ids.length === 0) return;

    try {
      const selectedFields = exportProjection(visibleColumns);
      const requestFields = selectedFields.includes(idField)
        ? selectedFields
        : [...selectedFields, idField];
      const results = await Promise.all(
        Array.from(
          { length: Math.ceil(ids.length / maxSelectedRows) },
          (_, index) =>
            dataRepository.selected(resource, {
              ids: ids.slice(
                index * maxSelectedRows,
                (index + 1) * maxSelectedRows,
              ),
              fields: requestFields,
            }),
        ),
      );
      const orderedRows = orderSelectedRows(
        results.flatMap((result) => result.rows),
        ids,
        idField,
      );
      downloadResourceExport(
        resource,
        orderedRows,
        fields,
        selectedFields,
        format,
        "selected",
      );
    } catch (error) {
      console.error("Download selected failed:", error);
      alert(
        formatUserFacingErrorMessage(
          error,
          "Failed to download selected results. See console for details.",
        ),
      );
    }
  }

  return { handleDownloadAll, handleDownloadSelected };
}
