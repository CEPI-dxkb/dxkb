"use client";

// Variant A — "Side panel · rail". The chat is a column of the page: it sits beside the content and the
// content narrows to make room, so nothing is ever underneath it. Minimized, it shrinks to a 44px
// spine on the right edge that keeps its own space, so the pager and the action rail stay put.

import { Bot, PanelRightOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copilotName } from "@/lib/copilot/name";
import { cn } from "@/lib/utils";
import { DockedPanel } from "./docked-panel";
import type { CopilotPanelVariant } from "../copilot-panel-header";
import type { DockApi, DockProps, TabSide } from "./dock-state";

export const railWidth = 44;

function Spine({ api }: { api: DockApi }) {
  const { working } = api.summary;
  const title = working
    ? `${copilotName} is writing an answer`
    : api.summary.preview || `Restore ${copilotName}`;
  return (
    <div className="absolute inset-y-0 right-0 flex w-11 flex-col items-center bg-muted/40">
      {/* An accent line down the spine while an answer is being written. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 bg-primary/20",
          working && "animate-pulse bg-primary",
        )}
      />
      <Button
        variant="ghost"
        size="icon"
        className="relative mt-2"
        aria-label={`Restore ${copilotName}`}
        title={title}
        onClick={api.restore}
      >
        <PanelRightOpen aria-hidden />
        {api.unread && (
          <span
            aria-hidden
            className="absolute top-1 right-1 size-2 rounded-full bg-info ring-2 ring-background"
          />
        )}
      </Button>
      <button
        type="button"
        title={title}
        onClick={api.restore}
        className="group/spine mt-1 flex w-full flex-1 flex-col items-center gap-3 py-3 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bot
          className={cn(
            "size-4 text-primary dark:text-link",
            working && "animate-pulse",
          )}
          aria-hidden
        />
        <span className="ac-vertical text-xs font-medium tracking-widest uppercase">
          {copilotName}
          {working ? " · writing" : ""}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="mb-2"
        aria-label={`Close ${copilotName}`}
        title="Close"
        onClick={api.close}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

/** The right column. `spine` keeps a 44px rail when minimized; without it the column goes to 0. */
export function SideDock({
  api,
  size,
  spine,
  panelVariant,
  side = "right",
}: {
  api: DockApi;
  size: number;
  spine: boolean;
  panelVariant: CopilotPanelVariant;
  side?: TabSide;
}) {
  const minimized = api.state === "minimized";
  const closedWidth = spine ? railWidth : 0;
  return (
    <aside
      aria-label={copilotName}
      // Fully minimized (no spine): hidden once the slide has finished, since a zero-width box would
      // still paint its border as a hairline at the screen edge.
      data-closed={minimized && !spine ? "" : undefined}
      className={cn(
        "ac-slide fixed top-(--ac-top) bottom-0 z-40 w-(--ac-width) overflow-hidden bg-background shadow-2xl",
        side === "right" ? "right-0 border-l" : "left-0 border-r",
      )}
      style={{ "--ac-width": `${String(minimized ? closedWidth : size)}px` } as React.CSSProperties}
    >
      {/* Pinned to the inner edge (the one facing the page), so the content travels with the sliding edge instead of being wiped away. */}
      <div
        inert={minimized}
        data-hidden={minimized ? "" : undefined}
        className={cn(
          "ac-slide-content absolute inset-y-0 w-(--ac-panel)",
          side === "right" ? "left-0" : "right-0",
          minimized && "pointer-events-none",
        )}
        style={
          {
            "--ac-panel": `${String(size)}px`,
            "--ac-shift": side === "right" ? "2.5rem" : "-2.5rem",
          } as React.CSSProperties
        }
      >
        <DockedPanel api={api} variant={panelVariant} />
      </div>
      {minimized && spine && <Spine api={api} />}
    </aside>
  );
}

export function VariantADock({ api, size }: DockProps) {
  return <SideDock api={api} size={size} spine panelVariant="dock" />;
}

export function variantAInset(state: DockProps["api"]["state"], size: number) {
  if (state === "open") return { right: size, bottom: 0 };
  if (state === "minimized") return { right: railWidth, bottom: 0 };
  return { right: 0, bottom: 0 };
}
