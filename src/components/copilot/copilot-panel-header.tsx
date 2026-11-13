"use client";

import { ArrowLeft, Bot, History, Minus, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copilotName } from "@/lib/copilot/name";
import { cn } from "@/lib/utils";
import { CopilotLayoutMenu } from "./copilot-layout-menu";

export type CopilotPanelVariant = "sheet" | "floating" | "page";

/**
 * One row. The side panel and the floating window get icon buttons (history, new chat, layout,
 * minimize, close) so the title keeps its room at the window's 320px minimum, and the Beta badge
 * shows only when the header is wider than 24rem. The full page keeps a labelled Chats button,
 * which stands in for its chat list on a phone.
 */
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
  const page = variant === "page";
  const historyLabel = showHistory ? "Back to the chat" : "Your earlier chats";
  const HistoryIcon = showHistory ? ArrowLeft : History;
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-1 border-b px-2 py-1.5",
        !page && "@container",
      )}
      onPointerDown={onPointerDown}
    >
      {page ? (
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          aria-pressed={showHistory}
          title={historyLabel}
          onClick={onToggleHistory}
        >
          <HistoryIcon aria-hidden />
          {showHistory ? "Back" : "Chats"}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-pressed={showHistory}
          aria-label={historyLabel}
          title={historyLabel}
          onClick={onToggleHistory}
        >
          <HistoryIcon aria-hidden />
        </Button>
      )}
      <Bot
        className="ml-1 size-4 shrink-0 text-primary dark:text-link"
        aria-hidden
      />
      <h2
        id={titleId}
        className="min-w-0 flex-1 truncate text-sm font-medium"
      >
        {showHistory ? "Your chats" : title}
        <span
          className={cn(
            "ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-3xs font-medium text-primary uppercase dark:bg-primary/25 dark:text-link",
            !page && "hidden @sm:inline",
          )}
        >
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
      {!page && <CopilotLayoutMenu surface={variant} />}
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
