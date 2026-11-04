/**
 * Pointer-resize geometry for the shared FileTable (`file-table.tsx`).
 *
 * A FileTable column's width setting is a share of the table, not its rendered
 * width: the fixed-layout table fills its scroll box, and the browser scales
 * every column up by the same factor when the settings add up to less than the
 * box (the workspace defaults total 535px). Resizing the setting by the pointer
 * delta therefore moved the dragged edge by a multiple of the pointer and
 * reflowed every other column.
 *
 * A drag instead works in rendered pixels: the columns before the dragged one
 * keep their widths, the dragged column takes the pointer delta, and the
 * columns after it give up (or take) the difference in proportion to their
 * widths, so the table keeps filling its box and the edge stays under the
 * pointer. Once they reach their minimum the table grows past the box and
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
  /** Index of the dragged column in `columnIds`. */
  index: number;
  /** Inner width of the table's scroll box, px. */
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

/** The factor the browser scales the settings by to fill the box (1 when they overflow it). */
export function columnScale(sizes: number[], containerWidth: number): number {
  const total = sum(sizes);
  return total > 0 && containerWidth > total ? containerWidth / total : 1;
}

/** Rendered widths (px, display order) after the dragged edge moved by `delta` px. */
export function resizedColumnWidths(
  start: ColumnResizeStart,
  delta: number,
): number[] {
  const { sizes, minSizes, maxSizes, index, containerWidth } = start;
  const scale = columnScale(sizes, containerWidth);
  const widths = sizes.map((size) => size * scale);
  const fills =
    containerWidth > 0 && sum(widths) <= containerWidth + fillTolerance;
  const before = sum(widths.slice(0, index));

  let dragged = clamp(
    widths[index] + delta,
    minSizes[index] * scale,
    maxSizes[index] * scale,
  );
  const following = widths.slice(index + 1);
  if (following.length === 0) {
    // Nothing after the last column can fill the box, so it cannot shrink
    // below the box's edge.
    if (fills) dragged = Math.max(dragged, containerWidth - before);
    return [...widths.slice(0, index), dragged];
  }

  const followingTotal = sum(following);
  const room = containerWidth - before - dragged;
  // A filling table keeps filling; an overflowing one only gives the
  // following columns room it would otherwise leave empty.
  const target = fills ? room : Math.max(followingTotal, room);
  const factor = followingTotal > 0 ? Math.max(0, target / followingTotal) : 1;
  return [
    ...widths.slice(0, index),
    dragged,
    ...following.map((width, offset) =>
      Math.max(width * factor, minSizes[index + 1 + offset] * scale),
    ),
  ];
}

/**
 * Width settings that render `widths` (from `resizedColumnWidths`) in the same
 * box, keyed by column id, for every column whose setting changes. While the
 * table fills its box the settings keep their old total, so the table still
 * fits a narrower window the way it did before the drag.
 */
export function columnWidthSettings(
  start: ColumnResizeStart,
  widths: number[],
): Record<string, number> {
  const { columnIds, sizes, minSizes, maxSizes, containerWidth } = start;
  const overflows = sum(widths) > containerWidth + fillTolerance;
  const scale = overflows ? 1 : columnScale(sizes, containerWidth);
  const settings: Record<string, number> = {};
  columnIds.forEach((columnId, i) => {
    const setting = clamp(
      Math.round(widths[i] / scale),
      minSizes[i],
      maxSizes[i],
    );
    if (setting !== sizes[i]) settings[columnId] = setting;
  });
  return settings;
}
