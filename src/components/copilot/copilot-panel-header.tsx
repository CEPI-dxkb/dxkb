"use client";

import {
  AppWindow,
  ArrowLeft,
  Bot,
  History,
  Maximize2,
  PanelRight,
  Settings2,
  SquarePen,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copilotPagePath } from "@/lib/copilot/paths";
import { useCopilot } from "./copilot-provider";

export type CopilotPanelVariant = "sheet" | "floating" | "page";

function ChatOptionsMenu({ variant }: { variant: CopilotPanelVariant }) {
  const copilot = useCopilot();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copilot options"
            title="Options"
          >
            <Settings2 aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {copilot.models.length === 0 ? (
            <DropdownMenuItem disabled>
              {copilot.modelsLoading
                ? "Loading models…"
                : "No models available"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuRadioGroup
              value={copilot.model ?? ""}
              onValueChange={(value: string) => {
                copilot.setModel(value);
              }}
            >
              {copilot.models.map((model) => (
                <DropdownMenuRadioItem key={model.model} value={model.model}>
                  <span className="truncate">{model.model}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuGroup>
        {variant !== "page" && <DropdownMenuSeparator />}
        {variant !== "page" && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Show the Copilot as</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={variant === "sheet"}
              onClick={() => {
                copilot.open("sheet");
              }}
            >
              <PanelRight aria-hidden />
              Side panel
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={variant === "floating"}
              onClick={() => {
                copilot.open("floating");
              }}
            >
              <AppWindow aria-hidden />
              Floating window
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={copilotPagePath} />}>
              <Maximize2 aria-hidden />
              Full page
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CopilotPanelHeader({
  variant,
  title,
  titleId,
  showHistory,
  onToggleHistory,
  newChatDisabled,
  onNewChat,
  onClose,
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
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <header
      className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
      onPointerDown={onPointerDown}
    >
      {/* The full page lists chats in its sidebar; on a phone the sidebar
          is hidden, so this button stands in for it there. */}
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
        className="ml-1 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <h2
        id={titleId}
        className="min-w-0 flex-1 truncate text-sm font-medium"
      >
        {showHistory ? "Your chats" : title}
        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground uppercase">
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
      {onClose && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close the Copilot"
          title="Close"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      )}
    </header>
  );
}
