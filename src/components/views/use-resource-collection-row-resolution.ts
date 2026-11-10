"use client";

import { useState } from "react";
import type { DataTableRow } from "@/components/shared/data-table";
import {
  maxExportRows,
  type DataRepository,
  type DataResource,
  type DataSort,
} from "@/lib/data-api";
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
  /**
   * The rows and total on screen belong to a previous query while this one
   * loads, so all-matching actions wait for `currentTotal`.
   */
  isPlaceholderData: boolean;
  /**
   * Rejects with `CancelledError` when the query is replaced first, which the
   * actions drop.
   */
  currentTotal: () => Promise<number>;
}

export interface MatchingRowsRead {
  rows: Record<string, unknown>[];
  total: number;
}

/**
 * A read that stops at the cap cannot tell, from the total on screen, whether
 * it holds every match, so that query is counted again.
 */
export async function readAllMatchingRows(
  repository: DataRepository,
  resource: DataResource,
  idField: string,
  request: MatchingRowsRequest & { fields: string[] },
): Promise<MatchingRowsRead> {
  const { rows } = await repository.exportAll(resource, request);
  if (rows.length < maxExportRows) return { rows, total: rows.length };
  const { total } = await repository.collection(resource, {
    rql: request.rql,
    keyword: request.keyword,
    keywordMode: request.keywordMode,
    pageSize: 1,
    fields: [idField],
  });
  return { rows, total };
}

export function exceedsReadLimit(
  { rows, total }: MatchingRowsRead,
  maxRows: number,
) {
  return rows.length > maxRows || total > rows.length;
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
  isPlaceholderData,
  currentTotal,
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

  const resolveAllMatchingRows = (fields: readonly string[]) =>
    readAllMatchingRows(repository, resource, idField, {
      rql,
      keyword,
      keywordMode,
      fields: [...fields],
      sort,
    });

  const resolveActionRows = async (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ): Promise<Record<string, unknown>[]> => {
    const isAllMatching = isAllPagesSelected && !hasLoadedKeyword;
    const limitError = () =>
      new Error(
        `${actionLabel} supports at most ${maxRows.toLocaleString()} ${label}. Narrow the selection and try again.`,
      );
    const count =
      isAllMatching && isPlaceholderData
        ? await currentTotal()
        : selectedActionCount;
    if (count > maxRows) throw limitError();
    if (!isAllMatching) {
      return fetchSelectedRows(
        repository,
        resource,
        idField,
        displayedSelectedIds,
        fields,
      );
    }
    const read = await resolveAllMatchingRows(fields);
    if (exceedsReadLimit(read, maxRows)) throw limitError();
    return read.rows;
  };

  return {
    rowById,
    rememberSelectedRows,
    resolveActionRows,
    resolveAllMatchingRows,
  };
}
