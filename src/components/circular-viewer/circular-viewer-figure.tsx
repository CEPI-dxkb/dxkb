"use client";

import { localPoint } from "@visx/event";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { useTooltip } from "@visx/tooltip";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type Ref,
} from "react";
import {
  buildTrackDrawings,
  createDrawingCache,
  hitTest,
  type FigureHit,
  type TrackData,
} from "@/lib/circular-viewer/drawing";
import {
  cursorFor,
  cursorTarget,
  firstCursor,
  itemStepKeys,
  stepCursor,
  type FigureCursor,
} from "@/lib/circular-viewer/keyboard";
import { itemAnnouncement } from "@/lib/circular-viewer/item-fields";
import {
  figureRadius,
  toPolar,
  type GenomeLayout,
} from "@/lib/circular-viewer/layout";
import type { CircularTrack } from "@/lib/circular-viewer/tracks";
import { CircularViewerItemDialog } from "./circular-viewer-item-dialog";
import { CircularViewerTooltip } from "./circular-viewer-tooltip";
import { CircularTrackLayer } from "./circular-viewer-track-layer";

export interface CircularViewerFigureProps {
  genomeId: string;
  layout: GenomeLayout;
  tracks: readonly CircularTrack[];
  data: ReadonlyMap<string, TrackData>;
  svgRef: Ref<SVGSVGElement>;
}

export function CircularViewerFigure({
  genomeId,
  layout,
  tracks,
  data,
  svgRef,
}: CircularViewerFigureProps) {
  const { parentRef, width, height } = useParentSize({
    debounceTime: 50,
  });
  // A hover re-renders this component and the drawings hold every mark's path;
  // the cache keeps unchanged tracks' drawings when another changes.
  const [drawingCache] = useState(createDrawingCache);
  const drawings = useMemo(
    () =>
      buildTrackDrawings(
        tracks,
        data,
        layout,
        figureRadius(width, height),
        drawingCache,
      ),
    [tracks, data, layout, width, height, drawingCache],
  );
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    showTooltip,
    hideTooltip,
  } = useTooltip();
  const [pinned, setPinned] = useState<FigureHit | null>(null);
  const [cursor, setCursor] = useState<FigureCursor | null>(null);
  const [cursorShown, setCursorShown] = useState(false);
  const pressedLast = useRef(false);
  const figureRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  useEffect(() => {
    const press = () => {
      pressedLast.current = true;
    };
    const key = () => {
      pressedLast.current = false;
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("keydown", key, true);
    };
  }, []);

  const keyTarget =
    cursorShown && cursor ? cursorTarget(drawings, cursor) : null;
  // Looked up from its stored point on every render so a hidden, removed or
  // redrawn track never leaves a stale tooltip.
  const pointerLeft = tooltipLeft ?? 0;
  const pointerTop = tooltipTop ?? 0;
  const pointerHit = tooltipOpen
    ? hitTest(
        drawings,
        toPolar(pointerLeft - width / 2, pointerTop - height / 2),
      )
    : null;
  const shown = pointerHit
    ? { hit: pointerHit, left: pointerLeft, top: pointerTop }
    : keyTarget
        ? {
            hit: keyTarget.hit,
            left: width / 2 + keyTarget.x,
            top: height / 2 + keyTarget.y,
          }
        : null;

  function hitAt(event: MouseEvent<SVGSVGElement>) {
    const point = localPoint(event);
    if (!point) return null;
    const hit = hitTest(
      drawings,
      toPolar(point.x - width / 2, point.y - height / 2),
    );
    return hit ? { hit, x: point.x, y: point.y } : null;
  }

  return (
    <div ref={parentRef} className="absolute inset-0">
      {/* The tab stop and keys live on an operable wrapper, since screen readers
         in browse mode hand arrow keys only to a widget. */}
      <div
        ref={figureRef}
        role="application"
        aria-roledescription="circular genome figure"
        // Not the image's name: a screen reader would read the same words twice.
        aria-label={`Genome ${genomeId}`}
        aria-describedby={hintId}
        tabIndex={0}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onFocus={() => {
          if (pressedLast.current) return;
          hideTooltip();
          setCursorShown(true);
          if (!cursor || !cursorTarget(drawings, cursor)) {
            setCursor(firstCursor(drawings));
          }
        }}
        onBlur={() => {
          setCursorShown(false);
        }}
        onKeyDown={(event) => {
          // Base UI moves focus on the next frame; its Escape must not also
          // hide the item it gives focus back to.
          if (pinned) return;
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const step = itemStepKeys[event.key];
          if (step) {
            // Also with nowhere to go, so the page does not scroll instead.
            event.preventDefault();
            hideTooltip();
            setCursorShown(true);
            if (keyTarget || !cursor || !cursorTarget(drawings, cursor)) {
              const next = stepCursor(drawings, cursor, step);
              if (next) setCursor(next);
            }
          } else if (event.key === "Enter" || event.key === " ") {
            if (!keyTarget) return;
            event.preventDefault();
            hideTooltip();
            setPinned(keyTarget.hit);
          } else if (event.key === "Escape") {
            hideTooltip();
            setCursorShown(false);
          }
        }}
      >
        {width > 0 && height > 0 && (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            role="img"
            aria-label={`Circular view of genome ${genomeId}`}
            onPointerMove={(event) => {
              const at = hitAt(event);
              if (at) {
                setCursorShown(false);
                showTooltip({ tooltipLeft: at.x, tooltipTop: at.y });
              } else hideTooltip();
            }}
            onPointerLeave={() => {
              hideTooltip();
            }}
            onPointerDown={() => {
              setCursorShown(false);
            }}
            onClick={(event) => {
              const at = hitAt(event);
              if (at) {
                hideTooltip();
                const clicked = cursorFor(drawings, at.hit);
                if (clicked) setCursor(clicked);
                setPinned(at.hit);
              }
            }}
          >
            <Group left={width / 2} top={height / 2}>
              {drawings.map((drawing) => (
                <CircularTrackLayer key={drawing.id} drawing={drawing} />
              ))}
              {shown && (
                <path
                  data-overlay
                  d={shown.hit.path}
                  className="pointer-events-none fill-destructive"
                />
              )}
            </Group>
          </svg>
        )}
      </div>
      {shown && (
        <CircularViewerTooltip
          hit={shown.hit}
          left={shown.left}
          top={shown.top}
          width={width}
          height={height}
        />
      )}
      <p id={hintId} className="sr-only">
        Arrow keys move between items: Left and Right along a ring, Home and End
        to its ends, Up and Down to the next ring out or in. Enter or Space
        shows the item&apos;s details; Escape hides the item.
      </p>
      <p aria-live="polite" className="sr-only">
        {keyTarget
          ? itemAnnouncement({ ...keyTarget, item: keyTarget.hit.item })
          : ""}
      </p>
      <CircularViewerItemDialog
        hit={pinned}
        onClose={() => {
          setPinned(null);
        }}
        returnFocus={() => {
          // React drops a focus event fired during a commit; the figure's
          // onFocus is what shows the keyboard's item again.
          queueMicrotask(() => {
            figureRef.current?.focus({ preventScroll: true });
          });
        }}
      />
    </div>
  );
}
