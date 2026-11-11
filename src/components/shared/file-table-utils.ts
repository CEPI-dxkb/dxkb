import type { Row, RowData } from "@tanstack/react-table";
import type { FileTableFeatures } from "./file-table";

/**
 * Use this rather than `row.getVisibleCells()` alone: the React Compiler caches
 * a row's cells on `row`, which a column reorder does not replace.
 */
export function orderedCells<T extends RowData>(
  row: Row<FileTableFeatures, T>,
  columnOrder: string[],
) {
  const cells = new Map(
    row.getVisibleCells().map((cell) => [cell.column.id, cell]),
  );
  return columnOrder.flatMap((id) => cells.get(id) ?? []);
}
