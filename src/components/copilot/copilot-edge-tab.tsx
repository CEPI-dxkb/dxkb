"use client";

import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useCopilotSession } from "@/hooks/copilot/use-copilot-queries";
import {
  answerPreview,
  isTabDrag,
  tabClickGuardMs,
  tabPlacementAt,
  tabPlacementForKey,
  tabTitle,
} from "@/lib/copilot/edge-tab";
import { copilotName } from "@/lib/copilot/name";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import type { CopilotTabPlacement } from "@/lib/ui-preferences/definitions";
import { cn } from "@/lib/utils";
import { useCopilot } from "./copilot-provider";

/**
 * The minimized chat: a small tab on a window edge that floats over the page and reserves no room.
 * Click it to restore the chat; drag it along the edge or across to the other one (it snaps to the
 * nearer side, and the chat opens on that side too), or move it with the arrow keys.
 */
export function CopilotEdgeTab({
  placement,
  onPlace,
}: {
  placement: CopilotTabPlacement;
  onPlace: (next: CopilotTabPlacement) => void;
}) {
  const copilot = useCopilot();
  const { side, top } = placement;
  // The tab slides in from the edge it first appears on; dropping it on the other edge must not replay that.
  const [enterSide] = useState(side);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastDragEnd = useRef(0);

  const working = isCopilotTurnActive(copilot.chat.active?.turn ?? null);
  // The panel already read this chat, so the newest answer comes from the cache.
  const session = useCopilotSession(copilot.sessionId, {
    enabled: true,
    streaming: working,
  });
  const newestAnswer = session.data?.messages.findLast(
    (message) => message.role === "assistant",
  )?.content;
  const title = tabTitle({
    working,
    unread: copilot.unread,
    preview: answerPreview(newestAnswer ?? ""),
  });
  const Chevron = side === "right" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={`Restore ${copilotName}`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      title={title}
      onClick={() => {
        // A drag ends with a click on the same button; it is not a restore.
        if (performance.now() - lastDragEnd.current < tabClickGuardMs) return;
        copilot.restore();
      }}
      onKeyDown={(event) => {
        const next = tabPlacementForKey(placement, event.key);
        if (!next) return;
        event.preventDefault();
        onPlace(next);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const origin = start.current;
        if (!origin) return;
        const point = { x: event.clientX, y: event.clientY };
        if (!origin.moved && !isTabDrag(origin, point)) return;
        origin.moved = true;
        setDrag(point);
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        if (!origin?.moved) return;
        lastDragEnd.current = performance.now();
        setDrag(null);
        onPlace(
          tabPlacementAt(
            { x: event.clientX, y: event.clientY },
            { width: window.innerWidth, height: window.innerHeight },
          ),
        );
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      className={cn(
        enterSide === "right" ? "copilot-tab-in-right" : "copilot-tab-in-left",
        "fixed top-(--tab-top) z-40 flex h-16 w-8 -translate-y-1/2 cursor-grab touch-none flex-col items-center justify-center gap-1 bg-primary text-primary-foreground shadow-lg outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
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
        {copilot.unread && (
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
