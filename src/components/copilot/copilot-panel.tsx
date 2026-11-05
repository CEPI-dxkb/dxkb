"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCopilotDraft } from "@/hooks/copilot/use-copilot-draft";
import {
  useCopilotSession,
  useCopilotSessions,
  useCopilotWorkflowWatches,
} from "@/hooks/copilot/use-copilot-queries";
import { useWorkflowWatchReload } from "@/hooks/copilot/use-workflow-watch-reload";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  attachmentOnlyQuery,
  copilotAttachmentFields,
  copilotModelFor,
} from "@/lib/copilot/attachments";
import {
  isCopilotSessionGone,
  setCopilotExecutionMode,
} from "@/lib/copilot/client";
import { copilotDraftSignal } from "@/lib/copilot/drafts";
import type { CopilotExecutionMode } from "@/lib/copilot/types";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import { CopilotCardActionsProvider } from "./copilot-card-actions";
import { CopilotComposer } from "./copilot-composer";
import {
  CopilotPanelHeader,
  type CopilotPanelVariant,
} from "./copilot-panel-header";
import {
  CopilotPlanActionsProvider,
  type CopilotPlanActions,
} from "./copilot-plan-card";
import { useCopilot } from "./copilot-provider";
import { CopilotSessionList } from "./copilot-session-list";
import { CopilotTranscript } from "./copilot-transcript";
import { newestCopilotPlan, useCopilotActions } from "./use-copilot-actions";

export type { CopilotPanelVariant };

/** Why a question was not sent, and (condensed) what it said. */
function unsentQuestionText(
  reason: string | null,
  question: string,
): string | undefined {
  const quoted =
    question.length > 200 ? `${question.slice(0, 200).trimEnd()}…` : question;
  const parts = [reason, quoted && `Your question: “${quoted}”`];
  return parts.filter(Boolean).join(" ") || undefined;
}

/** The open chat's title, from the session list (a new chat has none yet). */
function useSessionTitle(sessionId: string | null): string {
  const sessions = useCopilotSessions(sessionId !== null);
  const summary = sessions.data?.pages
    .flatMap((page) => page.sessions)
    .find((session) => session.sessionId === sessionId);
  return summary?.title ?? "New chat";
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
  // The draft belongs to the chat (and account), not to this surface: every
  // surface showing the chat shows it, and each chat keeps its own.
  const draft = useCopilotDraft(copilot.username, sessionId);
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

  // Plan/Execute: the one picked in this chat (a new chat's gateway session
  // saves it with the first question), else the stored mode.
  const executionMode = draft.mode ?? session.data?.executionMode ?? "plan";

  const changeMode = (mode: CopilotExecutionMode) => {
    draft.setMode(mode);
    if (sessionId && (session.data?.messages.length ?? 0) > 0) {
      setCopilotExecutionMode(sessionId, mode).catch((error: unknown) => {
        draft.setMode(null);
        toast.error("Could not change the mode", {
          description: error instanceof Error ? error.message : undefined,
        });
      });
    }
  };

  const queryClient = useQueryClient();
  const actions = useCopilotActions({ copilot, sessionId, executionMode });

  const hasImages = draft.attachments.some((item) => item.kind === "image");
  const turnModel = model
    ? copilotModelFor(copilot.models, model, hasImages)
    : null;
  const attachmentNote =
    hasImages && model && turnModel !== model
      ? turnModel
        ? `${model} cannot read images, so this question goes to ${turnModel}.`
        : "None of the Copilot's models can read images. Remove the image to send."
      : null;

  const send = async () => {
    const query =
      draft.text.trim() || (draft.attachments.length > 0 ? attachmentOnlyQuery : "");
    if (!query || !turnModel || draft.reading) return;
    // Taken first, so an account change during the send stops the restore.
    const signal = copilotDraftSignal();
    const taken = draft.take();
    const result = await actions.sendQuestion(query, {
      model: turnModel,
      ...copilotAttachmentFields(taken.attachments),
    });
    if (result.sent) return;
    // Back into the chat the send started in, even if another is open now.
    // Something typed or attached there since is not overwritten, so say
    // what was lost instead.
    if (!draft.restore(taken, signal) && !signal.aborted) {
      toast.error("Your question was not sent", {
        description: unsentQuestionText(result.message, taken.text),
      });
    }
  };

  const watches = useCopilotWorkflowWatches(sessionId, !showHistory);
  useWorkflowWatchReload(sessionId, watches.data, queryClient);

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
    <div
      className="flex size-full min-h-0 flex-col bg-background"
      // A file dropped anywhere on the panel would otherwise open in this
      // tab and replace the page. The composer takes drops it can attach;
      // everywhere else they are refused.
      onDragOver={(event) => {
        if (event.defaultPrevented || !event.dataTransfer.types.includes("Files")) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
      }}
      onDrop={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
    >
      <CopilotPanelHeader
        variant={variant}
        title={title}
        titleId={titleId}
        showHistory={showHistory}
        onToggleHistory={() => {
          setShowHistory((value) => !value);
        }}
        newChatDisabled={anyRunning}
        onNewChat={() => {
          newChat();
          setShowHistory(false);
        }}
        onClose={onClose}
        onPointerDown={onHeaderPointerDown}
      />

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
            onRetryLoad={() => {
              void session.refetch();
            }}
            onReload={() => {
              void chat.reload(sessionId);
            }}
            active={active}
            error={chat.error}
            // Resends exactly the question that failed, without the draft.
            onRetry={(query) => {
              void actions.sendTurn(query);
            }}
            onSuggestion={(text) => {
              draft.setText(text);
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
          value={draft.text}
          onChange={draft.setText}
          onSubmit={() => {
            void send();
          }}
          onStop={() => {
            void chat.stop();
          }}
          running={running}
          executionMode={executionMode}
          onExecutionModeChange={changeMode}
          attachments={draft.attachments}
          onAttach={(files) => {
            void draft.attach(files);
          }}
          onRemoveAttachment={draft.remove}
          reading={draft.reading}
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
            busyElsewhere ||
            // A stopped answer is still being saved and read back.
            chat.stopping
          }
          focusKey={focusKey}
        />
      )}
    </div>
  );
}
