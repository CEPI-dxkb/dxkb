"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { useOptionalCopilot } from "./copilot-provider";
import { copilotName } from "@/lib/copilot/name";
import { useAskClarkDock } from "./prototype/dock-state"; // PROTOTYPE (DXKBCORE-342)

export function CopilotLauncher({ compact = false }: { compact?: boolean }) {
  const copilot = useOptionalCopilot();
  const dock = useAskClarkDock();
  if (!copilot?.available || copilot.onCopilotPage) return null;
  const isOpen = copilot.openSurface !== null;
  const working = isCopilotTurnActive(copilot.chat.active?.turn ?? null);
  // PROTOTYPE (DXKBCORE-342): while a variant is active the button also restores / minimizes.
  const minimized = dock?.state === "minimized";
  const label = minimized
    ? `Restore ${copilotName}`
    : dock?.launcherMinimizes && isOpen
      ? `Minimize ${copilotName}`
      : isOpen
        ? `Close ${copilotName}`
        : `Open ${copilotName}`;

  return (
    <Button
      variant={compact ? "ghost-inverse" : "inverse-outline"}
      size={compact ? "sm" : "pill"}
      aria-label={label}
      aria-expanded={isOpen}
      title={working ? `${copilotName} is writing an answer` : label}
      onClick={() => {
        if (dock) dock.onLauncherClick();
        else if (isOpen) copilot.close();
        else copilot.open();
      }}
    >
      <span className="relative">
        <Bot className={working ? "size-4 animate-pulse" : "size-4"} aria-hidden />
        {minimized && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-2 rounded-full bg-info ring-2 ring-primary"
          />
        )}
      </span>
      {!compact && (
        <span className="text-sm">
          {copilotName}
          {minimized && dock.launcherChip && (
            <span className="ml-1.5 max-w-32 truncate text-xs opacity-80">
              {working ? "writing…" : dock.unread ? "answer ready" : "minimized"}
            </span>
          )}
        </span>
      )}
    </Button>
  );
}
