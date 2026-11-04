import { fullTurn } from "./layout";
import type { AngleSpan } from "./paths";

export interface IndexedSpan extends AngleSpan {
  /** The item's index in its track's item list. */
  index: number;
}

export interface SpanIndex {
  spans: readonly IndexedSpan[];
  /** The widest span, so a lookup knows how far back an overlapping span can start. */
  widest: number;
}

export function indexSpans(spans: readonly IndexedSpan[]): SpanIndex {
  const sorted = [...spans].sort((a, b) => a.startAngle - b.startAngle || b.endAngle - a.endAngle);
  return {
    spans: sorted,
    widest: sorted.reduce((widest, span) => Math.max(widest, span.endAngle - span.startAngle), 0),
  };
}

interface Nearest {
  span: IndexedSpan | undefined;
  distance: number;
}

/**
 * The nearest span to `angle` within `tolerance`, scanned on the unwrapped
 * line. Binary search, then a walk back over spans that could overlap.
 */
function nearestSpan(index: SpanIndex, angle: number, tolerance: number): Nearest {
  const { spans } = index;
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (spans[middle].startAngle <= angle + tolerance) low = middle + 1;
    else high = middle;
  }
  const earliest = angle - tolerance - index.widest;
  let best: IndexedSpan | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let at = low - 1; at >= 0 && spans[at].startAngle >= earliest; at -= 1) {
    const span = spans[at];
    const distance =
      angle < span.startAngle
        ? span.startAngle - angle
        : angle > span.endAngle
          ? angle - span.endAngle
          : 0;
    if (distance <= tolerance && distance < bestDistance) {
      best = span;
      bestDistance = distance;
      if (distance === 0) break;
    }
  }
  return { span: best, distance: bestDistance };
}

/**
 * The span under `angle`, else the nearest within `tolerance` radians: a
 * 1 kb gene on a 5 Mb genome is a fraction of a pixel wide. Of the spans
 * that contain the angle, the one that starts last (the innermost of nested
 * features).
 * Angles start at 0 and the pointer is in [0, 2π), so a pointer within
 * `tolerance` of 12 o'clock is also tried one turn over, to reach a span on
 * the other side of the seam.
 */
export function spanAt(
  index: SpanIndex,
  angle: number,
  tolerance: number,
): IndexedSpan | undefined {
  let best = nearestSpan(index, angle, tolerance);
  if (best.distance === 0) return best.span;
  const wrapped: number[] = [];
  if (angle - tolerance < 0) wrapped.push(angle + fullTurn);
  if (angle + tolerance >= fullTurn) wrapped.push(angle - fullTurn);
  for (const shifted of wrapped) {
    const found = nearestSpan(index, shifted, tolerance);
    if (found.distance < best.distance) best = found;
  }
  return best.span;
}

/**
 * The pieces of an index's spans that show when the one `spanAt` names is
 * on top: of the spans over an angle, the one that starts last (of equal
 * starts, the shorter, from `indexSpans`'s order). A change to that
 * precedence must change both. A heatmap paints these, one layer per color,
 * so the color under the pointer is the hovered window's whatever the
 * layers' order. The pieces come out clockwise and do not overlap. A sweep
 * keeps the open spans on a stack, latest start on top, so a span that ends
 * under a later one is dropped when it surfaces.
 */
export function visibleSegments(index: SpanIndex): IndexedSpan[] {
  const segments: IndexedSpan[] = [];
  const open: IndexedSpan[] = [];
  // How far round the pieces so far reach.
  let drawn = Number.NEGATIVE_INFINITY;
  /** Shows the top span up to `angle`, closing each span that ends by then. */
  const showUntil = (angle: number) => {
    for (let top = open.at(-1); top !== undefined; top = open.at(-1)) {
      const end = Math.min(top.endAngle, angle);
      if (end > drawn) {
        segments.push({ ...top, startAngle: drawn, endAngle: end });
        drawn = end;
      }
      if (top.endAngle > angle) return;
      open.pop();
    }
  };
  for (const span of index.spans) {
    showUntil(span.startAngle);
    drawn = Math.max(drawn, span.startAngle);
    open.push(span);
  }
  showUntil(Number.POSITIVE_INFINITY);
  return segments;
}
