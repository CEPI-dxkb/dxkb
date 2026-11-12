"use client";

// Variant C — "Floating · parked pill". Today's floating window plus a Minimize button. Minimized,
// it parks as a small pill in a strip along the bottom that the page keeps free (the pager sits
// above it), previewing the latest answer. It costs 56px of height but is always in the same
// place, whatever page you are on.

import { Bot, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copilotName } from "@/lib/copilot/name";
import { cn } from "@/lib/utils";
import { FloatingDock } from "./floating-dock";
import type { DockApi, DockProps, DockState } from "./dock-state";

export const stripHeight = 56;

function ParkedPill({ api }: { api: DockApi }) {
  const { working, preview } = api.summary;
  const text = working
    ? preview
      ? `Writing: ${preview}`
      : "Thinking…"
    : preview || `Ask ${copilotName} anything…`;
  return (
    <div className="fixed right-4 bottom-2 z-40 flex h-10 w-80 items-center gap-1 rounded-full border bg-background pr-1 pl-3 shadow-lg">
      <Bot
        className={cn(
          "size-4 shrink-0 text-primary dark:text-link",
          working && "animate-pulse",
        )}
        aria-hidden
      />
      <button
        type="button"
        onClick={api.restore}
        title={`Restore ${copilotName}`}
        className="relative flex h-8 min-w-0 flex-1 items-center rounded-full px-2 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="truncate">{text}</span>
      </button>
      {api.unread && (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-info" />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Restore ${copilotName}`}
        title="Restore"
        onClick={api.restore}
      >
        <ChevronUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Close ${copilotName}`}
        title="Close"
        onClick={api.close}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

export function VariantCDock({ api }: DockProps) {
  return (
    <>
      <FloatingDock api={api} />
      {api.state === "minimized" && <ParkedPill api={api} />}
    </>
  );
}

export function variantCInset(state: DockState) {
  return { right: 0, bottom: state === "minimized" ? stripHeight : 0 };
}
