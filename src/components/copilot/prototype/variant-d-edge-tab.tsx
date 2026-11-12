"use client";

// Variant D — "Edge tab", for both surfaces. Whatever surface AskClark is shown as (the options
// menu's "Show AskClark as": side panel or floating window), Minimize folds it into one small
// tab on a window edge. The tab floats OVER the page and reserves nothing. Drag it up or down
// along the edge, or across to the other edge (it snaps to the nearer side, and the side panel
// then docks on that side too). Arrow keys move it when focused. Click to bring the chat back.

import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { copilotName } from "@/lib/copilot/name";
import { cn } from "@/lib/utils";
import type { CopilotSurface } from "@/lib/ui-preferences/definitions";
import { useCopilot } from "../copilot-provider";
import { FloatingDock } from "./floating-dock";
import type { DockApi, DockProps, DockState, TabSide } from "./dock-state";
import { SideDock } from "./variant-a-rail";

const dragThreshold = 5;
const minTop = 0.08;
const maxTop = 0.94;

function clampTop(top: number): number {
  return Math.min(maxTop, Math.max(minTop, top));
}

function EdgeTab({ api }: { api: DockApi }) {
  const { side, top } = api.placement;
  // The tab slides in from the edge it first appears on; dropping it on the other edge must not replay that.
  const [enterSide] = useState(side);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastDragEnd = useRef(0);

  const { working, preview } = api.summary;
  const title = `${
    working
      ? `${copilotName} is writing an answer`
      : api.unread
        ? `${copilotName}: answer ready`
        : preview || `Restore ${copilotName}`
  }. Drag to move.`;
  const Chevron = side === "right" ? ChevronLeft : ChevronRight;

  const place = (nextSide: TabSide, nextTop: number) => {
    api.setPlacement({ side: nextSide, top: clampTop(nextTop) });
  };

  return (
    <button
      type="button"
      aria-label={`Restore ${copilotName}`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      title={title}
      onClick={() => {
        // A drag ends with a click on the same button; it is not a restore.
        if (performance.now() - lastDragEnd.current < 200) return;
        api.restore();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") place(side, top - 0.05);
        else if (event.key === "ArrowDown") place(side, top + 0.05);
        else if (event.key === "ArrowLeft") place("left", top);
        else if (event.key === "ArrowRight") place("right", top);
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const origin = start.current;
        if (!origin) return;
        if (
          !origin.moved &&
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < dragThreshold
        ) {
          return;
        }
        origin.moved = true;
        setDrag({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        if (!origin?.moved) return;
        lastDragEnd.current = performance.now();
        setDrag(null);
        place(
          event.clientX < window.innerWidth / 2 ? "left" : "right",
          event.clientY / window.innerHeight,
        );
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      className={cn(
        enterSide === "right" ? "ac-tab-in-right" : "ac-tab-in-left",
        "group/tab fixed top-(--tab-top) z-40 flex h-16 w-8 -translate-y-1/2 cursor-grab touch-none flex-col items-center justify-center gap-1 bg-primary text-primary-foreground shadow-lg outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
        drag
          ? "left-(--tab-x) -translate-x-1/2 rounded-2xl shadow-2xl"
          : side === "right"
            ? "right-0 rounded-l-2xl"
            : "left-0 rounded-r-2xl",
      )}
      style={
        {
          "--tab-top": drag ? `${String(drag.y)}px` : `${String(top * 100)}%`,
          "--tab-x": drag ? `${String(drag.x)}px` : "0px",
        } as React.CSSProperties
      }
    >
      <span className="relative">
        <Bot className={cn("size-5", working && "animate-pulse")} aria-hidden />
        {api.unread && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-2.5 rounded-full bg-info ring-2 ring-primary"
          />
        )}
      </span>
      <Chevron className="size-3.5 opacity-70" aria-hidden />
    </button>
  );
}

export function VariantDDock({ api, size }: DockProps) {
  const copilot = useCopilot();
  const floating = copilot.openSurface === "floating";
  return (
    <>
      {floating ? (
        <FloatingDock
          api={api}
          panelVariant="floating"
          edge={api.placement}
        />
      ) : (
        <SideDock
          api={api}
          size={size}
          spine={false}
          panelVariant="sheet"
          side={api.placement.side}
        />
      )}
      {/* The tab arrives as the window or panel finishes folding away. */}
      {api.state === "minimized" && <EdgeTab api={api} />}
    </>
  );
}

/** The tab floats over the page: only the open side panel makes the page give way. */
export function variantDInset(
  state: DockState,
  size: number,
  surface: CopilotSurface | null,
  side: TabSide,
) {
  const width = state === "open" && surface !== "floating" ? size : 0;
  return side === "left"
    ? { left: width, right: 0, bottom: 0 }
    : { left: 0, right: width, bottom: 0 };
}
