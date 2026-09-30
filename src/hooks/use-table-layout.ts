"use client";

import { useStorageItem } from "@/hooks/use-storage-item";
import { readStorageItem, writeStorageItem } from "@/lib/browser-storage";
import {
  mergeTableLayout,
  parseTableLayout,
  tableLayoutStorageKey,
  type TableLayout,
} from "@/lib/table-layout";

/**
 * One table's saved layout. Empty during server render and hydration, so the table
 * first renders its defaults and picks the saved layout up right after — tables
 * fetch their rows client-side, so that lands while the skeleton is showing.
 * `update` merges a patch into what is stored now (not a render-time copy), and a
 * field set to undefined is removed. Stored fields this build does not know are
 * written back untouched, so a newer build's additions survive an older tab. Every
 * table sharing a `tableKey` must show the same columns (and facets) with the same
 * defaults: a field is rewritten whole from the writer's own defaults, so a
 * different column set would drop the other's choices.
 */
export function useTableLayout(
  tableKey: string,
): readonly [TableLayout, (patch: Partial<TableLayout>) => void] {
  const storageKey = tableLayoutStorageKey(tableKey);
  const layout = parseTableLayout(useStorageItem(storageKey));
  const update = (patch: Partial<TableLayout>) => {
    writeStorageItem(
      storageKey,
      mergeTableLayout(readStorageItem(storageKey), patch),
    );
  };
  return [layout, update] as const;
}
