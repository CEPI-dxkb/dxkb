"use client";

import { useStorageItem } from "@/hooks/use-storage-item";
import { readStorageItem, writeStorageItem } from "@/lib/browser-storage";
import {
  mergeTableLayout,
  parseTableLayout,
  tableLayoutStorageKey,
  type TableLayout,
} from "@/lib/table-layout";

export type TableLayoutPatch =
  | Partial<TableLayout>
  | ((current: TableLayout) => Partial<TableLayout>);

/**
 * One table's saved layout; empty during server render and hydration. `update` merges a patch into what is stored now, and unknown stored fields are written back untouched.
 * Tables sharing a `tableKey` must show the same columns and defaults, since a field is rewritten whole from the writer's defaults.
 */
export function useTableLayout(
  tableKey: string,
): readonly [TableLayout, (patch: TableLayoutPatch) => void] {
  const storageKey = tableLayoutStorageKey(tableKey);
  const layout = parseTableLayout(useStorageItem(storageKey));
  const update = (patch: TableLayoutPatch) => {
    const raw = readStorageItem(storageKey);
    const resolved =
      typeof patch === "function" ? patch(parseTableLayout(raw)) : patch;
    writeStorageItem(storageKey, mergeTableLayout(raw, resolved));
  };
  return [layout, update] as const;
}
