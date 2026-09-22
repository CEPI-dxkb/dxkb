import type { RowSelectionState } from "@tanstack/react-table";

import type { TaxonRecord } from "./taxon-tree-types";

export interface TaxonomySelectionRow {
  id: string;
  original: TaxonRecord;
  getCanSelect: () => boolean;
}

export function toggleSelected(
  selected: RowSelectionState,
  rowId: string,
): RowSelectionState {
  const next = { ...selected };
  if (rowId in next) {
    Reflect.deleteProperty(next, rowId);
  } else {
    next[rowId] = true;
  }
  return next;
}

export function selectRange(
  rows: readonly TaxonomySelectionRow[],
  anchorId: string,
  targetId: string,
  selected: RowSelectionState,
  merge: boolean,
): RowSelectionState | undefined {
  const anchorIndex = rows.findIndex((row) => row.id === anchorId);
  const targetIndex = rows.findIndex((row) => row.id === targetId);
  if (anchorIndex === -1 || targetIndex === -1) return undefined;

  const next: RowSelectionState = merge ? { ...selected } : {};
  const from = Math.min(anchorIndex, targetIndex);
  const to = Math.max(anchorIndex, targetIndex);
  for (let index = from; index <= to; index++) {
    const row = rows[index];
    if (row.getCanSelect()) next[row.id] = true;
  }
  return next;
}

export function retainSelectedRecords(
  retained: ReadonlyMap<string, TaxonRecord>,
  selected: RowSelectionState,
  visibleRows: readonly TaxonomySelectionRow[],
): Map<string, TaxonRecord> {
  const records = new Map(retained);
  for (const row of visibleRows) {
    if (row.id in selected && row.getCanSelect()) {
      records.set(row.id, row.original);
    }
  }
  for (const id of records.keys()) {
    if (!(id in selected)) records.delete(id);
  }
  return records;
}
