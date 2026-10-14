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
   * loads, so an all-matching action waits for this query's own total
   * (`currentTotal`) rather than being sized by the wrong one. A background
   * refresh of the same query is not this; its total is this query's latest
   * count, and `exceedsReadLimit` checks the read itself.
   */
  isPlaceholderData: boolean;
  /**
   * This query's total once its read lands (`useResourceCollection`). Rejects
   * with `CancelledError` when the query is replaced first, which the actions
   * drop: the user has moved on from the results they acted on.
   */
  currentTotal: () => Promise<number>;
}

/** The rows an all-matching read returned, and how many rows match its query. */
export interface MatchingRowsRead {
  rows: Record<string, unknown>[];
  total: number;
}

/**
 * Read every row matching a query, up to the export cap. A read under the cap holds
 * every match. One that stops at the cap holds every match or only the first
 * `maxExportRows` of them, and the total on screen cannot tell which (a same-query
 * refresh keeps it, and the data can outgrow it with no refresh at all), so that
 * query is counted again.
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

/**
 * Whether an all-matching read is over `maxRows` although the total on screen, which
 * sized it, was not: it returned more than `maxRows` rows, or more rows match its
 * query than it could read.
 */
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

  // Scoped by the current query, whichever query's rows are on screen; each
  // caller applies its own size limit to `currentTotal` first while they are a
  // previous query's.
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
    // For every matching row the count is the total on screen, which is a
    // previous query's while this one loads, so the limit waits for this query's.
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
