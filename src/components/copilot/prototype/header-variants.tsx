"use client";

// PROTOTYPE (DXKBCORE-342): the chat header with a "Full page" button added, laid out three ways.
// Switched with `?header=1|2|3` (the second row of the switcher bar); "0" is today's header.
//
//   1 Two rows   — title and window controls on top, chat actions on a slim toolbar below.
//   2 Regrouped  — one row: history icon, title, chat actions | window controls.
//   3 Layout menu — one row, and "Show AskClark as" moves out of the gear into its own layout
//                   control (side panel, floating window, full page). No gear: the model picker
//                   lives in the composer.
//
// Delete with the rest of this folder; the winner gets folded into copilot-panel-header.tsx.

import {
  AppWindow,
  ArrowLeft,
  Bot,
  History,
  Maximize2,
  Minus,
  PanelRight,
  SquarePen,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { copilotName } from "@/lib/copilot/name";
import { copilotPagePath } from "@/lib/copilot/paths";
import { cn } from "@/lib/utils";
import { ChatOptionsMenu } from "../copilot-options-menu";
import type { CopilotPanelVariant } from "../copilot-panel-header";
import { useCopilot } from "../copilot-provider";
import type { HeaderKey } from "./dock-state";

interface HeaderProps {
  layout: Exclude<HeaderKey, "0">;
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
}

function Title({
  title,
  titleId,
  showHistory,
  betaAlways = false,
}: Pick<HeaderProps, "title" | "titleId" | "showHistory"> & {
  betaAlways?: boolean;
}) {
  return (
    <>
      <Bot
        className="ml-1 size-4 shrink-0 text-primary dark:text-link"
        aria-hidden
      />
      <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-medium">
        {showHistory ? "Your chats" : title}
        {/* In a narrow window the badge gives its room to the title. */}
        <span
          className={cn(
            "ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-3xs font-medium text-primary uppercase dark:bg-primary/25 dark:text-link",
            !betaAlways && "hidden @sm:inline",
          )}
        >
          Beta
        </span>
      </h2>
    </>
  );
}

function HistoryIconButton({
  showHistory,
  onToggleHistory,
}: Pick<HeaderProps, "showHistory" | "onToggleHistory">) {
  const label = showHistory ? "Back to the chat" : "Your earlier chats";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={showHistory}
      aria-label={label}
      title={label}
      onClick={onToggleHistory}
    >
      {showHistory ? <ArrowLeft aria-hidden /> : <History aria-hidden />}
    </Button>
  );
}

function NewChatIconButton({
  newChatDisabled,
  onNewChat,
}: Pick<HeaderProps, "newChatDisabled" | "onNewChat">) {
  return (
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
  );
}

function ExpandLink() {
  return (
    <Link
      href={copilotPagePath}
      aria-label="Open full page"
      title="Full page"
      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
    >
      <Maximize2 aria-hidden />
    </Link>
  );
}

/** Expand (unless the layout menu has it), Minimize and Close, set off from the chat actions. */
function WindowControls({
  expand,
  divider,
  onMinimize,
  onClose,
}: {
  expand: boolean;
  divider: boolean;
  onMinimize?: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      {divider && (
        <Separator orientation="vertical" className="mx-0.5 my-auto h-4" />
      )}
      {expand && <ExpandLink />}
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
    </>
  );
}

/** Variant 3: one button for where AskClark is shown. The docked prototype surfaces have no choice. */
function LayoutMenu({ variant }: { variant: CopilotPanelVariant }) {
  const copilot = useCopilot();
  if (variant === "dock") return <ExpandLink />;
  const floating = variant === "floating";
  const Icon = floating ? AppWindow : PanelRight;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Change ${copilotName} layout`}
            title="Layout"
          >
            <Icon aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show {copilotName} as</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!floating}
            onClick={() => {
              copilot.open("sheet");
            }}
          >
            <PanelRight aria-hidden />
            Side panel
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={floating}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PrototypeHeader(props: HeaderProps) {
  const {
    layout,
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
  } = props;

  if (layout === "1") {
    return (
      <header className="@container shrink-0 border-b" onPointerDown={onPointerDown}>
        <div className="flex items-center gap-1 px-2 py-1.5">
          <Title
            title={title}
            titleId={titleId}
            showHistory={showHistory}
            betaAlways
          />
          <WindowControls
            expand
            divider={false}
            onMinimize={onMinimize}
            onClose={onClose}
          />
        </div>
        <div className="flex items-center gap-1 border-t bg-muted/30 px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={showHistory}
            title={showHistory ? "Back to the chat" : "Your earlier chats"}
            onClick={onToggleHistory}
          >
            {showHistory ? <ArrowLeft aria-hidden /> : <History aria-hidden />}
            {showHistory ? "Back" : "Chats"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={newChatDisabled}
            onClick={onNewChat}
          >
            <SquarePen aria-hidden />
            New chat
          </Button>
          <span className="flex-1" />
          <ChatOptionsMenu variant={variant} />
        </div>
      </header>
    );
  }

  return (
    <header
      className="@container flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
      onPointerDown={onPointerDown}
    >
      <HistoryIconButton
        showHistory={showHistory}
        onToggleHistory={onToggleHistory}
      />
      <Title title={title} titleId={titleId} showHistory={showHistory} />
      <NewChatIconButton
        newChatDisabled={newChatDisabled}
        onNewChat={onNewChat}
      />
      {layout === "2" ? (
        <>
          <ChatOptionsMenu variant={variant} />
          <WindowControls
            expand
            divider
            onMinimize={onMinimize}
            onClose={onClose}
          />
        </>
      ) : (
        <>
          <LayoutMenu variant={variant} />
          <WindowControls
            expand={false}
            divider={false}
            onMinimize={onMinimize}
            onClose={onClose}
          />
        </>
      )}
    </header>
  );
}
