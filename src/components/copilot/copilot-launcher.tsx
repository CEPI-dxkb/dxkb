"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { useOptionalCopilot } from "./copilot-provider";
import { copilotName } from "@/lib/copilot/name";

export function CopilotLauncher({ compact = false }: { compact?: boolean }) {
  const copilot = useOptionalCopilot();
  if (!copilot?.available || copilot.onCopilotPage) return null;
  const isOpen = copilot.openSurface !== null;
  const working = isCopilotTurnActive(copilot.chat.active?.turn ?? null);
  const label = isOpen ? `Close ${copilotName}` : `Open ${copilotName}`;

  return (
    <Button
      variant={compact ? "ghost-inverse" : "inverse-outline"}
      size={compact ? "sm" : "pill"}
      aria-label={label}
      aria-expanded={isOpen}
      title={working ? `${copilotName} is writing an answer` : label}
      onClick={() => {
        if (isOpen) copilot.close();
        else copilot.open();
      }}
    >
      <Bot className={working ? "size-4 animate-pulse" : "size-4"} aria-hidden />
      {!compact && <span className="text-sm">{copilotName}</span>}
    </Button>
  );
}
