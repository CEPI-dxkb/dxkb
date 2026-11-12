"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { focusComposerWhenReady } from "@/lib/copilot/focus-composer";
import { copilotName } from "@/lib/copilot/name";
import type { CopilotTabSide } from "@/lib/ui-preferences/definitions";
import { cn } from "@/lib/utils";

// The chat (markdown, scroller) loads on first open, keeping it out of every route's bundle.
const CopilotPanel = dynamic(
  () => import("./copilot-panel").then((module) => module.CopilotPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

/**
 * The side panel: a column under the navbar on the edge tab's side. From `lg` up it does not cover
 * the page (`CopilotDockShell` gives the page's `main` a margin of the same width); below, it
 * overlays the page, at most the viewport wide. Minimized, it slides off its edge but stays mounted
 * (chat, scroll and draft kept), inert and, once the slide ends, hidden. Opening and restoring move
 * focus to the composer; Escape inside it closes it. Its width (`--dock-width`) and top
 * (`--dock-top`) come from the shell.
 */
export function CopilotSideDock({
  side,
  minimized,
  onMinimize,
  onClose,
}: {
  side: CopilotTabSide;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // On open (mount) and on restore; a re-render of the open panel leaves focus where it is.
  useEffect(() => {
    const content = contentRef.current;
    if (minimized || !content) return;
    return focusComposerWhenReady(content);
  }, [minimized]);

  return (
    <aside
      ref={asideRef}
      aria-label={copilotName}
      // A zero-width box still paints its border as a hairline at the screen edge, so the closed
      // panel is hidden once the slide has finished.
      data-closed={minimized ? "" : undefined}
      className={cn(
        "copilot-dock-slide fixed top-(--dock-top) bottom-0 z-40 max-w-full overflow-hidden bg-background shadow-2xl",
        minimized ? "w-0" : "w-(--dock-width)",
        side === "right" ? "right-0 border-l" : "left-0 border-r",
      )}
      onKeyDown={(event) => {
        // React delivers portal events (the layout, model and mode menus) to React parents too, so
        // check the real DOM; a menu or dialog that handles Escape itself prevents the default.
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          (asideRef.current?.contains(event.target as Node) ?? false)
        ) {
          onClose();
        }
      }}
    >
      {/* Pinned to the inner edge (the one facing the page), so the content travels with the sliding edge instead of being wiped away. */}
      {/* The pane is capped at the viewport, not at the aside, which narrows to 0 while it slides. */}
      <div
        ref={contentRef}
        inert={minimized}
        data-hidden={minimized ? "" : undefined}
        data-side={side}
        className={cn(
          "absolute inset-y-0 w-(--dock-width) max-w-screen copilot-dock-slide-content",
          side === "right" ? "left-0" : "right-0",
          minimized && "pointer-events-none",
        )}
      >
        <CopilotPanel variant="sheet" onMinimize={onMinimize} onClose={onClose} />
      </div>
    </aside>
  );
}
