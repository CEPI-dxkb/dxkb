"use client";

import { useState } from "react";
import type { DataTableRow } from "@/components/shared/data-table";
import type { DataRepository, DataResource, DataSort } from "@/lib/data-api";
import { maxSelectedRows } from "@/lib/data-api/validation";

interface MatchingRowsRequest {
  rql?: string;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
  sort?: DataSort;
}

interface UseResourceCollectionRowResolutionOptions<
  Row extends DataTableRow,
> extends MatchingRowsRequest {
  repository: DataRepository;
  resource: DataResource;
  idField: string;
  label: string;
  displayedRows: Row[];
  displayedSelectedIds: string[];
  selectedActionCount: number;
  isAllPagesSelected: boolean;
  hasLoadedKeyword: boolean;
  isRefreshing: boolean;
}

export async function fetchSelectedRows(
  repository: DataRepository,
  resource: DataResource,
  idField: string,
  ids: readonly string[],
  fields: readonly string[],
): Promise<Record<string, unknown>[]> {
  const requestFields = fields.includes(idField)
    ? [...fields]
    : [...fields, idField];
  const batches = await Promise.all(
    Array.from(
      { length: Math.ceil(ids.length / maxSelectedRows) },
      (_, index) =>
        repository.selected(resource, {
          ids: ids.slice(
            index * maxSelectedRows,
            (index + 1) * maxSelectedRows,
          ),
          fields: requestFields,
        }),
    ),
  );
  const orderById = new Map(ids.map((id, index) => [id, index]));
  return batches
    .flatMap((batch) => batch.rows)
    .sort(
      (left, right) =>
        (orderById.get(String(left[idField])) ?? Number.MAX_VALUE) -
        (orderById.get(String(right[idField])) ?? Number.MAX_VALUE),
    );
}

export function useResourceCollectionRowResolution<Row extends DataTableRow>({
  repository,
  resource,
  idField,
  label,
  displayedRows,
  displayedSelectedIds,
  selectedActionCount,
  isAllPagesSelected,
  hasLoadedKeyword,
  isRefreshing,
  rql,
  keyword,
  keywordMode,
  sort,
}: UseResourceCollectionRowResolutionOptions<Row>) {
  const [selectedRowsById, setSelectedRowsById] = useState<
    Partial<Record<string, Row>>
  >({});

  const rowById = (id: string) =>
    selectedRowsById[id] ??
    displayedRows.find((row) => String(row[idField]) === id);

  const rememberSelectedRows = (selection: Record<string, boolean>) => {
    setSelectedRowsById((current) => {
      const next: Record<string, Row> = {};
      for (const id of Object.keys(selection)) {
        const selectedRow =
          displayedRows.find((row) => String(row[idField]) === id) ??
          current[id];
        if (selectedRow) next[id] = selectedRow;
      }
      return next;
    });
  };

  const resolveAllMatchingRows = async (fields: readonly string[]) => {
    const result = await repository.exportAll(resource, {
      rql,
      keyword,
      keywordMode,
      fields: [...fields],
      sort,
    });
    return result.rows;
  };

  const resolveActionRows = async (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ): Promise<Record<string, unknown>[]> => {
    if (selectedActionCount > maxRows) {
      throw new Error(
        `${actionLabel} supports at most ${maxRows.toLocaleString()} ${label}. Narrow the selection and try again.`,
      );
    }
    if (!isAllPagesSelected || hasLoadedKeyword) {
      return fetchSelectedRows(
        repository,
        resource,
        idField,
        displayedSelectedIds,
        fields,
      );
    }
    if (isRefreshing) {
      throw new Error(
        "Wait for the current results to finish loading and try again.",
      );
    }
    return resolveAllMatchingRows(fields);
  };

  return {
    rowById,
    rememberSelectedRows,
    resolveActionRows,
    resolveAllMatchingRows,
  };
}
