import {
  spanHit,
  type FigureHit,
  type HoverItem,
  type TrackDrawing,
} from "./drawing";
import type { SpanIndex } from "./hit-test";
import { fullTurn, toCartesian } from "./layout";

export type ItemStep = "previous" | "next" | "first" | "last" | "outer" | "inner";

export const itemStepKeys: Readonly<Partial<Record<string, ItemStep>>> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  Home: "first",
  End: "last",
  ArrowUp: "outer",
  ArrowDown: "inner",
};

export interface FigureCursor {
  trackId: string;
  position: number;
}

export interface CursorTarget {
  hit: FigureHit;
  title: string;
  position: number;
  count: number;
  x: number;
  y: number;
}

interface NavigableRing {
  drawing: TrackDrawing;
  hits: SpanIndex;
  items: readonly HoverItem[];
}

function navigable(drawing: TrackDrawing): NavigableRing | null {
  const { body } = drawing;
  if (!drawing.visible || body.kind !== "marks" || body.hits === null) {
    return null;
  }
  if (body.hits.spans.length === 0) return null;
  return { drawing, hits: body.hits, items: body.items };
}

function middleAngle(ring: NavigableRing, position: number): number {
  const span = ring.hits.spans[position];
  return (span.startAngle + span.endAngle) / 2;
}

function turnDistance(a: number, b: number): number {
  const apart = Math.abs(a - b) % fullTurn;
  return Math.min(apart, fullTurn - apart);
}

function locate(
  drawings: readonly TrackDrawing[],
  cursor: FigureCursor,
): { ring: NavigableRing; at: number } | null {
  const at = drawings.findIndex((drawing) => drawing.id === cursor.trackId);
  const ring = at === -1 ? null : navigable(drawings[at]);
  if (!ring || cursor.position < 0) return null;
  if (cursor.position >= ring.hits.spans.length) return null;
  return { ring, at };
}

export function firstCursor(
  drawings: readonly TrackDrawing[],
): FigureCursor | null {
  const ring = drawings.find((drawing) => navigable(drawing) !== null);
  return ring ? { trackId: ring.id, position: 0 } : null;
}

export function stepCursor(
  drawings: readonly TrackDrawing[],
  cursor: FigureCursor | null,
  step: ItemStep,
): FigureCursor | null {
  const found = cursor ? locate(drawings, cursor) : null;
  if (!cursor || !found) return firstCursor(drawings);
  const { ring, at } = found;
  const count = ring.hits.spans.length;
  if (step === "outer" || step === "inner") {
    const direction = step === "outer" ? -1 : 1;
    const angle = middleAngle(ring, cursor.position);
    for (
      let index = at + direction;
      index >= 0 && index < drawings.length;
      index += direction
    ) {
      const next = navigable(drawings[index]);
      if (!next) continue;
      let best = 0;
      for (let position = 1; position < next.hits.spans.length; position += 1) {
        if (
          turnDistance(middleAngle(next, position), angle) <
          turnDistance(middleAngle(next, best), angle)
        ) {
          best = position;
        }
      }
      return { trackId: next.drawing.id, position: best };
    }
    return null;
  }
  const position =
    step === "first"
      ? 0
      : step === "last"
        ? count - 1
        : (cursor.position + (step === "next" ? 1 : count - 1)) % count;
  return { trackId: cursor.trackId, position };
}

export function cursorFor(
  drawings: readonly TrackDrawing[],
  hit: FigureHit,
): FigureCursor | null {
  const drawing = drawings.find((item) => item.id === hit.trackId);
  const ring = drawing ? navigable(drawing) : null;
  if (!ring) return null;
  const position = ring.hits.spans.findIndex(
    (span) => ring.items[span.index] === hit.item,
  );
  return position === -1 ? null : { trackId: hit.trackId, position };
}

export function cursorTarget(
  drawings: readonly TrackDrawing[],
  cursor: FigureCursor,
): CursorTarget | null {
  const found = locate(drawings, cursor);
  if (!found) return null;
  const { ring } = found;
  const { drawing } = ring;
  const point = toCartesian(
    middleAngle(ring, cursor.position),
    (drawing.ring.innerRadius + drawing.ring.outerRadius) / 2,
  );
  return {
    hit: spanHit(drawing, ring.items, ring.hits.spans[cursor.position]),
    title: drawing.title,
    position: cursor.position,
    count: ring.hits.spans.length,
    x: point.x,
    y: point.y,
  };
}
