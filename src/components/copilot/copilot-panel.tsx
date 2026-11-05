"use client";

import {
  AlertCircle,
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
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  useCopilotSession,
  useCopilotSessions,
  useCopilotWorkflowWatches,
} from "@/hooks/copilot/use-copilot-queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  attachmentOnlyQuery,
  copilotAttachmentFields,
  copilotModelFor,
  maxCopilotAttachments,
  readCopilotAttachment,
  type CopilotAttachment,
} from "@/lib/copilot/attachments";
import {
  copilotQueryKeys,
  isCopilotSessionGone,
  setCopilotExecutionMode,
} from "@/lib/copilot/client";
import type { CopilotExecutionMode } from "@/lib/copilot/types";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { CopilotCardActionsProvider } from "./copilot-cards";
import { CopilotComposer } from "./copilot-composer";
import {
  CopilotPlanActionsProvider,
  type CopilotPlanActions,
} from "./copilot-plan-card";
import { copilotPagePath, useCopilot } from "./copilot-provider";
import { CopilotSessionList } from "./copilot-session-list";
import { CopilotTranscript } from "./copilot-transcript";
import { newestCopilotPlan, useCopilotActions } from "./use-copilot-actions";

export type CopilotPanelVariant = "sheet" | "floating" | "page";

/** The open chat's title, from the session list (a new chat has none yet). */
function useSessionTitle(sessionId: string | null): string {
  const sessions = useCopilotSessions(sessionId !== null);
  const summary = sessions.data?.pages
    .flatMap((page) => page.sessions)
    .find((session) => session.sessionId === sessionId);
  return summary?.title ?? "New chat";
}

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

/**
 * The chat itself, shared by the side panel, the floating window and the
 * full page. `onClose` is given where the surface can be closed; `dragHandle`
 * receives the header's pointer-down for the floating window.
 */
export function CopilotPanel({
  variant,
  onClose,
  onHeaderPointerDown,
  titleId,
}: {
  variant: CopilotPanelVariant;
  onClose?: () => void;
  onHeaderPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  /** Id for the surface's accessible name. */
  titleId?: string;
}) {
  const copilot = useCopilot();
  const { chat, sessionId, model } = copilot;
  const [draft, setDraft] = useState("");
  const [focusKey, setFocusKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const active = chat.active?.sessionId === sessionId ? chat.active : null;
  const running = isCopilotTurnActive(active?.turn ?? null);
  const session = useCopilotSession(sessionId, {
    enabled: true,
    streaming: running,
  });
  const title = useSessionTitle(sessionId);

  // An archived chat, or one from another account on this device: start over.
  const gone = isCopilotSessionGone(session.error);
  const { newChat } = copilot;
  const startOver = useEffectEvent(() => {
    newChat();
  });
  useEffect(() => {
    if (gone) startOver();
  }, [gone]);

  // Plan/Execute: the stored mode, or the one picked here before the chat's
  // first question (the gateway saves it with that question).
  const [modeChoice, setModeChoice] = useState<{
    sessionId: string | null;
    mode: CopilotExecutionMode;
  } | null>(null);
  const executionMode =
    (modeChoice?.sessionId === sessionId ? modeChoice.mode : undefined) ??
    session.data?.executionMode ??
    "plan";

  const changeMode = (mode: CopilotExecutionMode) => {
    setModeChoice({ sessionId, mode });
    if (sessionId && (session.data?.messages.length ?? 0) > 0) {
      setCopilotExecutionMode(sessionId, mode).catch((error: unknown) => {
        setModeChoice(null);
        toast.error("Could not change the mode", {
          description: error instanceof Error ? error.message : undefined,
        });
      });
    }
  };

  const queryClient = useQueryClient();
  const actions = useCopilotActions({ copilot, sessionId, executionMode });

  // Files attached to the next question.
  const [attachments, setAttachments] = useState<CopilotAttachment[]>([]);
  const attach = async (files: File[]) => {
    const room = maxCopilotAttachments - attachments.length;
    if (files.length > room) {
      toast.error(
        `Up to ${String(maxCopilotAttachments)} files can go with a question.`,
      );
    }
    const read = await Promise.all(
      files.slice(0, Math.max(room, 0)).map((file) =>
        readCopilotAttachment(file).catch((error: unknown) => ({
          error: `${file.name}: ${error instanceof Error ? error.message : "could not be read."}`,
        })),
      ),
    );
    const added: CopilotAttachment[] = [];
    for (const entry of read) {
      if ("error" in entry) toast.error(entry.error);
      else added.push(entry.attachment);
    }
    setAttachments((current) =>
      [...current, ...added].slice(0, maxCopilotAttachments),
    );
  };
  const hasImages = attachments.some((item) => item.kind === "image");
  const turnModel = model
    ? copilotModelFor(copilot.models, model, hasImages)
    : null;
  const attachmentNote =
    hasImages && model && turnModel !== model
      ? turnModel
        ? `${model} cannot read images, so this question goes to ${turnModel}.`
        : "None of the Copilot's models can read images. Remove the image to send."
      : null;

  const send = async (text: string) => {
    const query = text.trim() || (attachments.length > 0 ? attachmentOnlyQuery : "");
    if (!query || !turnModel) return;
    const sending = attachments;
    setDraft("");
    setAttachments([]);
    const sent = await actions.sendQuestion(query, {
      model: turnModel,
      ...copilotAttachmentFields(sending),
    });
    if (!sent) {
      setDraft((current) => current || text.trim());
      setAttachments((current) => (current.length > 0 ? current : sending));
    }
  };

  // Jobs the chat waits for: when one ends, the gateway writes a completion
  // message into the chat a moment later; reload it then.
  const watches = useCopilotWorkflowWatches(sessionId, !showHistory);
  const watchingRef = useRef<{ sessionId: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!sessionId || !watches.data) return;
    const running = new Set(
      watches.data
        .filter((watch) => watch.status === "active")
        .map((watch) => watch.submissionId),
    );
    const before =
      watchingRef.current?.sessionId === sessionId ? watchingRef.current.ids : null;
    watchingRef.current = { sessionId, ids: running };
    if (!before || [...before].every((id) => running.has(id))) return;
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({
        queryKey: copilotQueryKeys.session(sessionId),
        exact: true,
      });
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [watches.data, sessionId, queryClient]);

  const busyElsewhere = !active && Boolean(session.data?.activeJobId);
  const newestPlan = newestCopilotPlan(session.data);
  const planActions: CopilotPlanActions = {
    ...actions.planActions,
    currentPlanId: newestPlan?.plan.planId ?? null,
    busy: isCopilotTurnActive(chat.active?.turn ?? null) || busyElsewhere,
    liveUpdates: active?.turn.planUpdates ?? [],
    watches: watches.data,
  };
  const stepReply = actions.stepAwaitingReply();

  const anyRunning = isCopilotTurnActive(chat.active?.turn ?? null);

  return (
    <div className="flex size-full min-h-0 flex-col bg-background">
      <header
        className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
        onPointerDown={onHeaderPointerDown}
      >
        {/* The full page lists chats in its sidebar; on a phone the sidebar
            is hidden, so this button stands in for it there. */}
        <Button
          variant="ghost"
          size="sm"
          className={variant === "page" ? "md:hidden" : undefined}
          aria-pressed={showHistory}
          title={showHistory ? "Back to the chat" : "Your earlier chats"}
          onClick={() => {
            setShowHistory((value) => !value);
          }}
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
          disabled={anyRunning}
          onClick={() => {
            newChat();
            setShowHistory(false);
            setDraft("");
          }}
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        {showHistory ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CopilotSessionList
              currentSessionId={sessionId}
              onSelect={(next) => {
                copilot.selectSession(next);
                setShowHistory(false);
              }}
              onDeletedCurrent={newChat}
            />
          </div>
        ) : sessionId ? (
          <CopilotCardActionsProvider value={actions.cardActions}>
          <CopilotPlanActionsProvider value={planActions}>
          <CopilotTranscript
            sessionId={sessionId}
            detail={session.data}
            loading={session.isPending}
            loadError={gone ? null : session.error}
            onReload={() => {
              void session.refetch();
            }}
            active={active}
            error={chat.error}
            onRetry={(query) => {
              void send(query);
            }}
            onSuggestion={(text) => {
              setDraft(text);
              setFocusKey((value) => value + 1);
            }}
          />
          </CopilotPlanActionsProvider>
          </CopilotCardActionsProvider>
        ) : null}
      </div>

      {copilot.modelsError && (
        <div className="px-3 pt-2">
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>
              <p>{copilot.modelsError.message}</p>
            </AlertDescription>
          </Alert>
        </div>
      )}
      {!showHistory && (
        <CopilotComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            void send(draft);
          }}
          onStop={() => {
            void chat.stop();
          }}
          running={running}
          executionMode={executionMode}
          onExecutionModeChange={changeMode}
          attachments={attachments}
          onAttach={(files) => {
            void attach(files);
          }}
          onRemoveAttachment={(id) => {
            setAttachments((current) => current.filter((item) => item.id !== id));
          }}
          note={attachmentNote}
          canSendEmpty
          placeholder={
            stepReply
              ? `Reply to step ${String(stepReply.stepIndex + 1)}'s question…`
              : undefined
          }
          disabled={
            !model ||
            !sessionId ||
            // Until the chat loads, it is not known whether this is its first
            // question (which titles the chat).
            session.isPending ||
            // One answer at a time: another chat is being answered here, or
            // this one is being answered in another tab.
            (anyRunning && !running) ||
            busyElsewhere
          }
          focusKey={focusKey}
        />
      )}
    </div>
  );
}
