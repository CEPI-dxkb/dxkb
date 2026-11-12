"use client";

import { ArrowLeft, Bot, History, Minus, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copilotName } from "@/lib/copilot/name";
import { ChatOptionsMenu } from "./copilot-options-menu";
import { useAskClarkDock, useAskClarkHeader } from "./prototype/dock-state"; // PROTOTYPE (DXKBCORE-342)
import { PrototypeHeader } from "./prototype/header-variants"; // PROTOTYPE (DXKBCORE-342)

// PROTOTYPE (DXKBCORE-342): "dock" is the pushed/docked prototype surface; remove with the prototype.
export type CopilotPanelVariant = "sheet" | "floating" | "page" | "dock";

export function CopilotPanelHeader({
  variant,
  title,
  titleId,
  showHistory,
  onToggleHistory,
  newChatDisabled,
  onNewChat,
  onClose,
  onMinimize,
  onPointerDown,
}: {
  variant: CopilotPanelVariant;
  title: string;
  titleId?: string;
  showHistory: boolean;
  onToggleHistory: () => void;
  newChatDisabled: boolean;
  onNewChat: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  const dock = useAskClarkDock();
  const layout = useAskClarkHeader();
  if (dock && layout !== "0" && variant !== "page") {
    return (
      <PrototypeHeader
        layout={layout}
        variant={variant}
        title={title}
        titleId={titleId}
        showHistory={showHistory}
        onToggleHistory={onToggleHistory}
        newChatDisabled={newChatDisabled}
        onNewChat={onNewChat}
        onClose={onClose}
        onMinimize={onMinimize}
        onPointerDown={onPointerDown}
      />
    );
  }
  return (
    <header
      className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
      onPointerDown={onPointerDown}
    >
      {/* On a phone the sidebar is hidden, so this button stands in for it. */}
      <Button
        variant="ghost"
        size="sm"
        className={variant === "page" ? "md:hidden" : undefined}
        aria-pressed={showHistory}
        title={showHistory ? "Back to the chat" : "Your earlier chats"}
        onClick={onToggleHistory}
      >
        {showHistory ? <ArrowLeft aria-hidden /> : <History aria-hidden />}
        {showHistory ? "Back" : "Chats"}
      </Button>
      <Bot
        className="ml-1 size-4 shrink-0 text-primary dark:text-link"
        aria-hidden
      />
      <h2
        id={titleId}
        className="min-w-0 flex-1 truncate text-sm font-medium"
      >
        {showHistory ? "Your chats" : title}
        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-3xs font-medium text-primary uppercase dark:bg-primary/25 dark:text-link">
          Beta
        </span>
      </h2>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New chat"
        title="New chat"
        disabled={newChatDisabled}
        onClick={onNewChat}
      >
        <SquarePen aria-hidden />
      </Button>
      <ChatOptionsMenu variant={variant} />
      {onMinimize && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Minimize ${copilotName}`}
          title="Minimize"
          onClick={onMinimize}
        >
          <Minus aria-hidden />
        </Button>
      )}
      {onClose && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Close ${copilotName}`}
          title="Close"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      )}
    </header>
  );
}
