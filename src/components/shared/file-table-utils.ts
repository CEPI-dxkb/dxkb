import type { Row, RowData } from "@tanstack/react-table";
import type { FileTableFeatures } from "./file-table";

/**
 * A row's visible cells in `columnOrder` (from `useDataTableBody()`). Use this
 * rather than `row.getVisibleCells()` alone: the React Compiler caches a row's
 * cells on the `row` object, which a column reorder does not replace, so the
 * order has to be an input for the row to re-render with it.
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
