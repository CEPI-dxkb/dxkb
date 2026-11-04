/**
 * Pointer-resize geometry for the shared tables: FileTable (`file-table.tsx`)
 * and the collection DataTable (`data-table.tsx`).
 *
 * Both tables keep a width setting per column that is a share of the table,
 * not its rendered width: the table fills its scroll box, and every resizable
 * column is scaled up by the same factor when the settings add up to less than
 * the box (the workspace defaults total 535px). Resizing the setting by the
 * pointer delta therefore moved the dragged edge by a multiple of the pointer
 * and reflowed every other column.
 *
 * A drag instead works in rendered pixels: the columns before the dragged one
 * keep their widths, the dragged column takes the pointer delta, and the
 * resizable columns after it give up (or take) the difference in proportion to
 * their widths, so the table keeps filling its box and the edge stays under
 * the pointer. Once they reach their minimum the table grows past the box and
 * scrolls. On release `columnWidthSettings` turns the rendered widths back into
 * settings that render the same layout.
 */

export interface ColumnResizeStart {
  /** Visible column ids, in display order. */
  columnIds: string[];
  /** Each column's width setting (TanStack `getSize()`), same order. */
  sizes: number[];
  minSizes: number[];
  maxSizes: number[];
  /**
   * Columns that are not resizable (the DataTable's selection column): they
   * keep their width, neither stretch nor absorb a drag. Absent: none.
   */
  fixed?: boolean[];
  /** Index of the dragged column in `columnIds`. */
  index: number;
  /** Width the table's columns fill, px (the scroll box's inner width). */
  containerWidth: number;
}

/** Tolerance for sub-pixel rounding when deciding whether the table fills its box. */
const fillTolerance = 0.5;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The factor the resizable columns are scaled by to fill the box (1 when the
 * settings overflow it). `fixed` columns keep their width and are not scaled.
 */
export function columnScale(
  sizes: number[],
  containerWidth: number,
  fixed?: boolean[],
): number {
  const fixedTotal = sum(sizes.filter((_, i) => fixed?.[i]));
  const scalableTotal = sum(sizes) - fixedTotal;
  const room = containerWidth - fixedTotal;
  return scalableTotal > 0 && room > scalableTotal ? room / scalableTotal : 1;
}

/** Rendered widths (px, display order) of a table at rest: the settings, scaled to fill. */
export function stretchedColumnWidths(
  sizes: number[],
  containerWidth: number,
  fixed?: boolean[],
): number[] {
  const scale = columnScale(sizes, containerWidth, fixed);
  return sizes.map((size, i) => (fixed?.[i] ? size : size * scale));
}

/** Rendered widths (px, display order) after the dragged edge moved by `delta` px. */
export function resizedColumnWidths(
  start: ColumnResizeStart,
  delta: number,
): number[] {
  const { sizes, minSizes, maxSizes, fixed, index, containerWidth } = start;
  const isFixed = (i: number) => fixed?.[i] === true;
  const scale = columnScale(sizes, containerWidth, fixed);
  const widths = stretchedColumnWidths(sizes, containerWidth, fixed);
  if (isFixed(index)) return widths;
  const fills =
    containerWidth > 0 && sum(widths) <= containerWidth + fillTolerance;
  const before = sum(widths.slice(0, index));

  const dragged = clamp(
    widths[index] + delta,
    minSizes[index] * scale,
    maxSizes[index] * scale,
  );
  const following = widths.slice(index + 1);
  const absorbing = following.filter((_, offset) => !isFixed(index + 1 + offset));
  if (absorbing.length === 0) {
    // Nothing after this column can fill the box, so it cannot shrink below
    // the box's edge.
    const rest = sum(following);
    return [
      ...widths.slice(0, index),
      fills ? Math.max(dragged, containerWidth - before - rest) : dragged,
      ...following,
    ];
  }

  const absorbingTotal = sum(absorbing);
  const room = containerWidth - before - dragged - (sum(following) - absorbingTotal);
  // A filling table keeps filling; an overflowing one only gives the
  // following columns room it would otherwise leave empty.
  const target = fills ? room : Math.max(absorbingTotal, room);
  const factor = Math.max(0, target / absorbingTotal);
  return [
    ...widths.slice(0, index),
    dragged,
    ...following.map((width, offset) => {
      const i = index + 1 + offset;
      return isFixed(i) ? width : Math.max(width * factor, minSizes[i] * scale);
    }),
  ];
}

/**
 * Width settings that render `widths` (from `resizedColumnWidths`) in the same
 * box, keyed by column id, for every resizable column whose setting changes.
 * While the table fills its box the settings keep their old total, so the
 * table still fits a narrower window the way it did before the drag.
 */
export function columnWidthSettings(
  start: ColumnResizeStart,
  widths: number[],
): Record<string, number> {
  const { columnIds, sizes, minSizes, maxSizes, fixed, containerWidth } = start;
  const overflows = sum(widths) > containerWidth + fillTolerance;
  const scale = overflows ? 1 : columnScale(sizes, containerWidth, fixed);
  const settings: Record<string, number> = {};
  columnIds.forEach((columnId, i) => {
    if (fixed?.[i]) return;
    const setting = clamp(
      Math.round(widths[i] / scale),
      minSizes[i],
      maxSizes[i],
    );
    if (setting !== sizes[i]) settings[columnId] = setting;
  });
  return settings;
}
