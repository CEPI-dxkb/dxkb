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
 * their widths, each held within its own min and max (`distributeWidths`). The
 * table keeps filling its box and the edge stays under the pointer; it grows
 * past the box (and scrolls) only once the following columns reach their
 * minimum.
 *
 * `resizeColumns` quantizes the result: the saved settings are integers that
 * keep a filling table's total, and the preview is drawn from those settings,
 * so nothing moves on release. The edge trails the pointer by at most half a
 * setting step (scale/2 px) while the table fills; once it overflows,
 * re-rounding the columns before it can add up to about 1px more.
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

/** Tolerance for sub-pixel rounding when deciding if the table fills its box. */
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

/** Rendered widths (px, display order) of a table at rest, scaled to fill. */
export function stretchedColumnWidths(
  sizes: number[],
  containerWidth: number,
  fixed?: boolean[],
): number[] {
  const scale = columnScale(sizes, containerWidth, fixed);
  return sizes.map((size, i) => (fixed?.[i] ? size : size * scale));
}

/** Float noise below this is ignored when checking bounds. */
const boundTolerance = 1e-9;

/**
 * Splits `total` px across columns in proportion to `widths`, keeping each in
 * `[lo[i], hi[i]]`. A column that reaches a bound is pinned there and the rest
 * share what is left (water-filling). A `total` outside `[Σlo, Σhi]` gives
 * every column its bound.
 */
export function distributeWidths(
  widths: number[],
  lo: number[],
  hi: number[],
  total: number,
): number[] {
  const result = widths.map(() => 0);
  const pinned = widths.map(() => false);
  const target = clamp(total, sum(lo), sum(hi));
  for (let pass = 0; pass <= widths.length; pass++) {
    const free = widths.flatMap((_, i) => (pinned[i] ? [] : [i]));
    if (free.length === 0) break;
    const left = target - sum(result.filter((_, i) => pinned[i]));
    const base = sum(free.map((i) => widths[i]));
    let under = 0;
    let over = 0;
    for (const i of free) {
      result[i] = base > 0 ? (widths[i] * left) / base : left / free.length;
      under += Math.max(0, lo[i] - result[i]);
      over += Math.max(0, result[i] - hi[i]);
    }
    if (under <= boundTolerance && over <= boundTolerance) break;
    // Pin one side per pass. Clamping the larger side's violators moves the
    // others the same way, so a column pinned here never has to come back.
    const pinLow = under >= over;
    for (const i of free) {
      if (pinLow && result[i] < lo[i]) {
        result[i] = lo[i];
        pinned[i] = true;
      } else if (!pinLow && result[i] > hi[i]) {
        result[i] = hi[i];
        pinned[i] = true;
      }
    }
  }
  return result;
}

/**
 * Rounds `values` to integers that total `total` (default
 * `Math.round(Σ values)`, by largest remainder), so a filling table's settings
 * keep their total and its scale.
 */
function roundPreservingTotal(
  values: number[],
  total = Math.round(sum(values)),
): number[] {
  const snapped = values.map((value) =>
    Math.abs(value - Math.round(value)) < 1e-6 ? Math.round(value) : value,
  );
  const result = snapped.map(Math.floor);
  let short = total - sum(result);
  const byRemainder = snapped
    .map((_, i) => i)
    .sort((a, b) => snapped[b] - result[b] - (snapped[a] - result[a]));
  for (const i of byRemainder) {
    if (short <= 0) break;
    result[i] += 1;
    short -= 1;
  }
  return result;
}

/** Rendered widths (px, display order) once the dragged edge moves `delta` px. */
export function resizedColumnWidths(
  start: ColumnResizeStart,
  delta: number,
): number[] {
  const { sizes, minSizes, maxSizes, fixed, index, containerWidth } = start;
  const isFixed = (i: number) => fixed?.[i] === true;
  const widths = stretchedColumnWidths(sizes, containerWidth, fixed);
  if (isFixed(index)) return widths;
  const scale = columnScale(sizes, containerWidth, fixed);
  const measured = containerWidth > 0;
  const fills = measured && sum(widths) <= containerWidth + fillTolerance;
  const before = sum(widths.slice(0, index));
  const after = widths.map((_, i) => i).slice(index + 1);
  const absorbing = after.filter((i) => !isFixed(i));
  const fixedAfter = sum(after.filter(isFixed).map((i) => widths[i]));
  const lo = absorbing.map((i) => minSizes[i] * scale);
  const hi = absorbing.map((i) => maxSizes[i] * scale);
  /** Width left for the absorbing columns when the dragged one is `dragged` wide. */
  const space = (dragged: number) =>
    containerWidth - before - fixedAfter - dragged;

  // Never so narrow that the absorbing columns, all at their maximum, would
  // leave the box partly empty; with none, never short of the box's edge.
  const minDragged = Math.max(
    minSizes[index] * scale,
    measured ? space(0) - sum(hi) : -Infinity,
  );
  // While the table fills, the setting keeps the start's scale. Past the
  // width at which the absorbing columns reach their minimum, the table
  // overflows, renders unscaled, and its setting is its width.
  const overflowAt = space(0) - sum(lo);
  // The overflow switch renders every other column unscaled, so it is only
  // allowed when the columns that keep their width fit their own maximum;
  // otherwise saving them would clamp (and move) them.
  // Columns after the dragged one render at min * scale once overflowing but
  // are saved at scale 1, so they must fit at that width too.
  const keepFit = widths.every((width, i) =>
    i === index
      ? true
      : i > index && !isFixed(i)
        ? minSizes[i] * scale <= maxSizes[i] + boundTolerance
        : width <= maxSizes[i] + boundTolerance,
  );
  const cappedAtOverflow = Math.min(maxSizes[index] * scale, overflowAt);
  const maxDragged = !fills
    ? maxSizes[index]
    : keepFit
      ? Math.max(cappedAtOverflow, maxSizes[index])
      : cappedAtOverflow;
  // If the bounds cross, filling the box wins over the column's maximum.
  const dragged = clamp(
    widths[index] + delta,
    minDragged,
    Math.max(minDragged, maxDragged),
  );

  const current = absorbing.map((i) => widths[i]);
  // A filling table keeps filling; an overflowing one only gives the
  // following columns room it would otherwise leave empty.
  const target = fills
    ? space(dragged)
    : Math.max(sum(current), space(dragged));
  const absorbed = distributeWidths(current, lo, hi, target);
  const result = widths.slice();
  result[index] = dragged;
  absorbing.forEach((i, j) => {
    result[i] = absorbed[j];
  });
  return result;
}

/**
 * Integer width settings that render `widths` (from `resizedColumnWidths`) in
 * the same box, keyed by column id, for every resizable column whose setting
 * changes. While the table fills its box, the settings keep their old total
 * (and so the scale), so the table still fits a narrower window the way it
 * did before the drag.
 */
export function columnWidthSettings(
  start: ColumnResizeStart,
  widths: number[],
): Record<string, number> {
  const { columnIds, sizes, minSizes, maxSizes, fixed, containerWidth } = start;
  const overflows = sum(widths) > containerWidth + fillTolerance;
  const scale = overflows ? 1 : columnScale(sizes, containerWidth, fixed);
  const resizable = columnIds.flatMap((_, i) => (fixed?.[i] ? [] : [i]));
  const values = resizable.map((i) => widths[i] / scale);
  // The dragged column takes its nearest integer so the edge trails the
  // pointer by at most scale / 2; the others share the rest of the total.
  const at = resizable.indexOf(start.index);
  let rounded: number[];
  if (at < 0) {
    rounded = roundPreservingTotal(values);
  } else {
    const pinned = clamp(
      Math.round(values[at]),
      minSizes[start.index],
      maxSizes[start.index],
    );
    const others = roundPreservingTotal(
      values.filter((_, j) => j !== at),
      Math.round(sum(values)) - pinned,
    );
    rounded = values.map((_, j) =>
      j === at ? pinned : others[j < at ? j : j - 1],
    );
  }
  const settings: Record<string, number> = {};
  resizable.forEach((i, j) => {
    // A no-op for widths from resizedColumnWidths; kept for any other caller.
    const setting = clamp(rounded[j], minSizes[i], maxSizes[i]);
    if (setting !== sizes[i]) settings[columnIds[i]] = setting;
  });
  return settings;
}

/**
 * A drag's preview and the settings its release saves, from one source: the
 * preview is the saved settings, stretched as the table renders them at rest,
 * so nothing moves on release. The edge trails the pointer by at most half a
 * setting step (`scale / 2` px) while the table fills; once it overflows,
 * re-rounding the columns before it can add up to about 1px more.
 */
export function resizeColumns(
  start: ColumnResizeStart,
  delta: number,
): { widths: number[]; settings: Record<string, number> } {
  const settings = columnWidthSettings(start, resizedColumnWidths(start, delta));
  const saved = start.columnIds.map((id, i) => settings[id] ?? start.sizes[i]);
  return {
    widths: stretchedColumnWidths(saved, start.containerWidth, start.fixed),
    settings,
  };
}
