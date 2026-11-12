"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { useOptionalCopilot } from "./copilot-provider";
import { copilotName } from "@/lib/copilot/name";

/** The navbar button: opens the chat, minimizes an open one, and restores a minimized one. Only the chat's own Close button closes it. */
export function CopilotLauncher({ compact = false }: { compact?: boolean }) {
  const copilot = useOptionalCopilot();
  if (!copilot?.available || copilot.onCopilotPage) return null;
  const isOpen = copilot.openSurface !== null;
  const { minimized } = copilot;
  const working = isCopilotTurnActive(copilot.chat.active?.turn ?? null);
  const label = !isOpen
    ? `Open ${copilotName}`
    : minimized
      ? `Restore ${copilotName}`
      : `Minimize ${copilotName}`;

  return (
    <Button
      variant={compact ? "ghost-inverse" : "inverse-outline"}
      size={compact ? "sm" : "pill"}
      aria-label={label}
      aria-expanded={isOpen && !minimized}
      title={working ? `${copilotName} is writing an answer` : label}
      onClick={() => {
        if (!isOpen) copilot.open();
        else if (minimized) copilot.restore();
        else copilot.minimize();
      }}
    >
      <span className="relative">
        <Bot className={working ? "size-4 animate-pulse" : "size-4"} aria-hidden />
        {minimized && copilot.unread && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-2 rounded-full bg-info ring-2 ring-primary"
          />
        )}
      </span>
      {!compact && <span className="text-sm">{copilotName}</span>}
    </Button>
  );
}
