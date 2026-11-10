import { fullTurn } from "./layout";
import type { AngleSpan } from "./paths";

export interface IndexedSpan extends AngleSpan {
  index: number;
}

export interface SpanIndex {
  spans: readonly IndexedSpan[];
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
 * A pointer within `tolerance` of 12 o'clock is also tried one turn over, to
 * reach a span across the seam.
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
 * Must match `spanAt`'s precedence (the span that starts last wins; of equal
 * starts, the shorter); a change to one must change both.
 */
export function visibleSegments(index: SpanIndex): IndexedSpan[] {
  const segments: IndexedSpan[] = [];
  const open: IndexedSpan[] = [];
  let drawn = Number.NEGATIVE_INFINITY;
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
