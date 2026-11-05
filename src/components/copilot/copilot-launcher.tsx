"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { useOptionalCopilot } from "./copilot-provider";

/**
 * The navbar's Copilot button: opens the chat where the user last had it
 * (side panel or floating window), or closes it. Hidden when signed out and
 * on the full Copilot page (and outside the provider).
 */
export function CopilotLauncher({ compact = false }: { compact?: boolean }) {
  const copilot = useOptionalCopilot();
  if (!copilot?.available || copilot.onCopilotPage) return null;
  const isOpen = copilot.openSurface !== null;
  const working = isCopilotTurnActive(copilot.chat.active?.turn ?? null);
  const label = isOpen ? "Close the Copilot" : "Open the Copilot";

  return (
    <Button
      variant={compact ? "ghost-inverse" : "inverse-outline"}
      size={compact ? "sm" : "pill"}
      aria-label={label}
      aria-expanded={isOpen}
      title={working ? "The Copilot is writing an answer" : label}
      onClick={() => {
        if (isOpen) copilot.close();
        else copilot.open();
      }}
    >
      <Bot className={working ? "size-4 animate-pulse" : "size-4"} aria-hidden />
      {!compact && <span className="text-sm">Copilot</span>}
    </Button>
  );
}
