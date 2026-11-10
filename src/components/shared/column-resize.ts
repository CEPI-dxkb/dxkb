/**
 * Pointer-resize geometry shared by FileTable and DataTable.
 * A drag works in rendered pixels, not width settings (which are shares of the
 * table): columns before the dragged one keep their widths, it takes the
 * pointer delta, and the resizable columns after it absorb the difference
 * within their bounds.
 */

export interface ColumnResizeStart {
  columnIds: string[];
  sizes: number[];
  minSizes: number[];
  maxSizes: number[];
  fixed?: boolean[];
  index: number;
  containerWidth: number;
}

const fillTolerance = 0.5;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

export function stretchedColumnWidths(
  sizes: number[],
  containerWidth: number,
  fixed?: boolean[],
): number[] {
  const scale = columnScale(sizes, containerWidth, fixed);
  return sizes.map((size, i) => (fixed?.[i] ? size : size * scale));
}

const boundTolerance = 1e-9;

/**
 * Water-filling split: a column that reaches a bound is pinned there and the
 * rest share what is left.
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
    // Pin one side per pass: clamping the larger side's violators moves the
    // others the same way, so a pinned column never has to come back.
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
  const space = (dragged: number) =>
    containerWidth - before - fixedAfter - dragged;

  const minDragged = Math.max(
    minSizes[index] * scale,
    measured ? space(0) - sum(hi) : -Infinity,
  );
  // While the table fills, the setting keeps the start's scale; once the
  // absorbing columns reach their minimum it overflows, renders unscaled, and
  // the setting is its width.
  const overflowAt = space(0) - sum(lo);
  // The overflow switch renders other columns unscaled, so it is only allowed
  // when the columns that keep their width fit their maximum.
  // Columns after the dragged one render at min * scale but save at scale 1, so
  // they must fit at that width too.
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
 * Integer settings that render `widths` in the same box; while the table fills
 * they keep their old total, and so the scale.
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
  // The dragged column takes its nearest integer so the edge trails the pointer
  // by at most scale / 2.
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
    const setting = clamp(rounded[j], minSizes[i], maxSizes[i]);
    if (setting !== sizes[i]) settings[columnIds[i]] = setting;
  });
  return settings;
}

/**
 * A drag's preview is the settings its release saves, so nothing moves on
 * release.
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
