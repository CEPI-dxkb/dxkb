"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { CopilotPanel } from "./copilot-panel";
import { useCopilot } from "./copilot-provider";
import { CopilotSessionList } from "./copilot-session-list";

/**
 * The full-page Copilot: the user's chats on the left, the open chat beside
 * them. Shares its state with the side panel and floating window.
 */
export function CopilotPage() {
  const copilot = useCopilot();
  const running = isCopilotTurnActive(copilot.chat.active?.turn ?? null);
  return (
    <div className="flex min-h-0 flex-1">
      <h1 className="sr-only">Copilot</h1>
      <aside
        className="hidden w-72 shrink-0 flex-col border-r bg-muted/30 md:flex"
        aria-label="Your chats"
      >
        <div className="border-b p-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={running}
            onClick={copilot.newChat}
          >
            <Plus aria-hidden />
            New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CopilotSessionList
            currentSessionId={copilot.sessionId}
            onSelect={copilot.selectSession}
            onDeletedCurrent={copilot.newChat}
          />
        </div>
      </aside>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <CopilotPanel variant="page" />
      </div>
    </div>
  );
}
