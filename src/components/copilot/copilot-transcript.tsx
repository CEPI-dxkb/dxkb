"use client";

import { AlertCircle, Bot, Loader2, Square, Unplug } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CopilotActiveTurn,
  CopilotChatError,
} from "@/hooks/copilot/use-copilot-chat";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import type { CopilotSessionDetail } from "@/lib/copilot/types";
import {
  CopilotAssistantMessage,
  CopilotStreamingMessage,
  CopilotUserMessage,
} from "./copilot-message";
import { CopilotLiveStatus } from "./copilot-progress";
import { copilotName } from "@/lib/copilot/name";

const copilotSuggestions = [
  "Find complete Mpox virus genomes collected since 2022",
  "Which antimicrobial resistance genes are common in Klebsiella pneumoniae?",
  "Summarize what is known about the H5N1 hemagglutinin protein",
  "How do I annotate a bacterial genome assembly?",
  "Compare the genomes of two Salmonella strains",
  "What data does DXKB have on Nipah virus?",
] as const;

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-link">
        <Bot className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-medium">Ask {copilotName}</p>
        <p className="text-sm text-muted-foreground">
          It searches BV-BRC data, explains results, and prepares analysis jobs.
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-2">
        <p className="text-left text-xs font-medium text-muted-foreground">Try asking</p>
        {copilotSuggestions.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            className="h-auto justify-start text-left whitespace-normal"
            onClick={() => {
              onSuggestion(suggestion);
            }}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4" aria-busy="true" aria-label="Loading chat">
      <Skeleton className="ml-auto h-10 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="ml-auto h-10 w-1/2" />
    </div>
  );
}

export interface CopilotTranscriptProps {
  sessionId: string;
  detail: CopilotSessionDetail | undefined;
  loading: boolean;
  loadError: Error | null;
  onRetryLoad: () => void;
  onReload: () => void;
  active: CopilotActiveTurn | null;
  error: CopilotChatError | null;
  onRetry: (query: string) => void;
  onSuggestion: (text: string) => void;
}

export function CopilotTranscript({
  sessionId,
  detail,
  loading,
  loadError,
  onRetryLoad,
  onReload,
  active,
  error,
  onRetry,
  onSuggestion,
}: CopilotTranscriptProps) {
  if (loading) return <TranscriptSkeleton />;
  if (loadError && !detail) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>Could not load this chat</AlertTitle>
          <AlertDescription>
            <p>{loadError.message}</p>
            <Button variant="outline" size="sm" onClick={onRetryLoad}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const stored = detail?.messages ?? [];
  const messages = active ? stored.slice(0, active.baseCount) : stored;
  const turn = active?.turn ?? null;
  const running = isCopilotTurnActive(turn);
  // A turn started in another tab, or one whose stream dropped: poll the session until it ends.
  const busyElsewhere = !active && Boolean(detail?.activeJobId);
  const sessionError = error?.sessionId === sessionId ? error : null;
  // The gateway checks a reply against the cards it stored, so only the newest card takes answers,
  // and only while nothing runs.
  const last = messages.at(-1);
  // Only the newest question is a scroll anchor: when a turn ends its live items are replaced by
  // saved copies, and the scroller would otherwise jump to the chat's first anchor.
  const lastQuestionId = messages.findLast(
    (message) => message.role === "user",
  )?.id;
  const modelShownIds = new Set<string>();
  let previousModel: string | undefined;
  for (const message of messages) {
    if (message.role !== "assistant" || !message.model) continue;
    if (message.model !== previousModel) modelShownIds.add(message.id);
    previousModel = message.model;
  }
  const lastAnswerId = messages.findLast(
    (message) => message.role === "assistant",
  )?.id;
  const answerableId =
    !turn && !busyElsewhere && last?.role === "assistant" && last.card
      ? last.id
      : null;

  if (messages.length === 0 && !turn && !busyElsewhere && !sessionError) {
    // Scrolls inside its own box: in a short window the suggestions would otherwise spill over the
    // composer below.
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    );
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller>
        <MessageScrollerViewport aria-label={`${copilotName} conversation`}>
          <MessageScrollerContent aria-busy={running} density="compact">
            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.id === lastQuestionId}
              >
                <div className="px-4">
                  {message.role === "user" ? (
                    <CopilotUserMessage
                      content={message.content}
                      answers={message.clarificationAnswers}
                      attachments={message.attachments}
                      latest={!turn && message.id === lastQuestionId}
                      onRetry={
                        message.isClarification ||
                        running ||
                        message.attachments.some((item) => item.type !== "execution")
                          ? undefined
                          : () => {
                              onRetry(message.content);
                            }
                      }
                    />
                  ) : (
                    <CopilotAssistantMessage
                      sessionId={sessionId}
                      message={message}
                      interactive={message.id === answerableId}
                      latest={!turn && message.id === lastAnswerId}
                      showModel={modelShownIds.has(message.id)}
                    />
                  )}
                </div>
              </MessageScrollerItem>
            ))}
            {turn && !active?.hidden && (
              <MessageScrollerItem messageId={turn.id} scrollAnchor>
                <div className="px-4">
                  <CopilotUserMessage
                    content={turn.query}
                    answers={active?.clarificationAnswers ?? []}
                    attachments={active?.attachments ?? []}
                  />
                </div>
              </MessageScrollerItem>
            )}
            {turn && (
              <MessageScrollerItem
                messageId={`${turn.id}-answer`}
                scrollAnchor={active?.hidden}
              >
                <div className="px-4">
                  <CopilotStreamingMessage
                    steps={turn.steps}
                    answer={turn.answer}
                    card={turn.card}
                    live={
                      running ? (
                        <CopilotLiveStatus
                          label={turn.liveLabel}
                          queuedMessage={turn.queuedMessage}
                        />
                      ) : turn.status === "stopped" ? (
                        <Marker>
                          <MarkerIcon>
                            <Square />
                          </MarkerIcon>
                          <MarkerContent>Stopped</MarkerContent>
                        </Marker>
                      ) : turn.status === "disconnected" ? (
                        <Marker>
                          <MarkerIcon>
                            <Unplug />
                          </MarkerIcon>
                          <MarkerContent>Connection lost</MarkerContent>
                        </Marker>
                      ) : null
                    }
                  />
                </div>
              </MessageScrollerItem>
            )}
            {busyElsewhere && (
              <MessageScrollerItem messageId="busy-elsewhere">
                <div className="px-4">
                  <Marker role="status">
                    <MarkerIcon>
                      <Loader2 className="animate-spin" />
                    </MarkerIcon>
                    <MarkerContent>
                      {copilotName} is still working on this chat. The answer
                      appears here when it is done.
                    </MarkerContent>
                  </Marker>
                </div>
              </MessageScrollerItem>
            )}
            {sessionError && (
              <MessageScrollerItem messageId="turn-error">
                <div className="px-4 pb-2">
                  {sessionError.kind === "reload" ? (
                    <Alert variant="destructive">
                      <AlertCircle aria-hidden />
                      <AlertTitle>Could not reload this chat</AlertTitle>
                      <AlertDescription>
                        <p>{sessionError.message}</p>
                        <Button variant="outline" size="sm" onClick={onReload}>
                          Reload
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle aria-hidden />
                      <AlertTitle>{copilotName} could not answer</AlertTitle>
                      <AlertDescription>
                        <p>{sessionError.message}</p>
                        {sessionError.query && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (sessionError.query) onRetry(sessionError.query);
                            }}
                          >
                            Retry
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
