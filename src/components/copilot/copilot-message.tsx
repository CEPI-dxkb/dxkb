"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  LayoutList,
  Paperclip,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import { copilotQueryKeys, rateCopilotMessage } from "@/lib/copilot/client";
import { readClarificationCard, readExecutionCard } from "@/lib/copilot/cards";
import { readCopilotPlan } from "@/lib/copilot/plan";
import type {
  CopilotAttachmentInfo,
  CopilotCard,
  CopilotClarificationAnswer,
  CopilotMessage,
  CopilotSessionDetail,
  CopilotStep,
} from "@/lib/copilot/types";
import { ClarificationCardView } from "./copilot-clarification-card";
import { ExecutionCardView } from "./copilot-execution-card";
import { CopilotMarkdown } from "./copilot-markdown";
import { PlanCardView } from "./copilot-plan-card";
import { CopilotSteps } from "./copilot-progress";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy"}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
            }, 1500);
          })
          .catch((error: unknown) => {
            toast.error("Could not copy the message", {
              description: error instanceof Error ? error.message : undefined,
            });
          });
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  );
}

const cardLabels: Record<string, string> = {
  plan: "a multi-step plan",
  clarification: "questions for you",
  execution_blocked: "a job waiting for your approval",
};

/**
 * An answer's card: a plan, or the interactive question and approval cards,
 * or a notice for one DXKB cannot read.
 */
function MessageCard({
  messageId,
  card,
  interactive,
  live = false,
}: {
  messageId: string;
  card: CopilotCard;
  interactive: boolean;
  live?: boolean;
}) {
  if (card.cardType === "plan") {
    const plan = readCopilotPlan(card.payload);
    if (plan) return <PlanCardView messageId={messageId} plan={plan} live={live} />;
  }
  if (card.cardType === "clarification") {
    const clarification = readClarificationCard(card.payload);
    if (clarification) {
      return (
        <ClarificationCardView
          messageId={messageId}
          card={clarification}
          interactive={interactive}
        />
      );
    }
  }
  if (card.cardType === "execution_blocked") {
    const execution = readExecutionCard(card.payload);
    if (execution) {
      return (
        <ExecutionCardView
          messageId={messageId}
          card={execution}
          interactive={interactive}
        />
      );
    }
  }
  return <CardNotice card={card} />;
}

/** For a card DXKB cannot draw (an unknown kind, or one it cannot read). */
function CardNotice({ card }: { card: CopilotCard }) {
  return (
    <Marker variant="border">
      <MarkerIcon>
        <LayoutList />
      </MarkerIcon>
      <MarkerContent>
        This answer includes {cardLabels[card.cardType] ?? `a ${card.cardType} card`},
        which DXKB cannot show. Open this chat on BV-BRC to act on it.
      </MarkerContent>
    </Marker>
  );
}

/**
 * Rating saves still running, per message id: the newest one (a token unique
 * to that save) and the last rating the server confirmed. Only the newest
 * save's failure rolls back, and it rolls back to the confirmed rating, so an
 * older failure never undoes a newer click (even one that set the same value)
 * and overlapping failures never leave a rating the server did not store.
 * Module-level rather than a ref, so it outlives a remount while a save
 * runs; an entry goes once its newest save settles.
 */
const ratingSaves = new Map<
  string,
  { latest: object; confirmed: CopilotMessage["rating"] }
>();

function RatingButtons({
  sessionId,
  message,
}: {
  sessionId: string;
  message: CopilotMessage;
}) {
  const queryClient = useQueryClient();
  const key = copilotQueryKeys.session(sessionId);
  const ratingOf = () =>
    queryClient
      .getQueryData<CopilotSessionDetail>(key)
      ?.messages.find((item) => item.id === message.id)?.rating;
  const setRating = (rating: CopilotMessage["rating"]) => {
    queryClient.setQueryData<CopilotSessionDetail>(key, (detail) =>
      detail
        ? {
            ...detail,
            messages: detail.messages.map((item) =>
              item.id === message.id ? { ...item, rating } : item,
            ),
          }
        : detail,
    );
  };
  const rate = useMutation({
    mutationFn: (rating: -1 | 0 | 1) => rateCopilotMessage(message.id, rating),
    onMutate: async (rating) => {
      const save = {};
      const running = ratingSaves.get(message.id);
      ratingSaves.set(message.id, {
        latest: save,
        // With no save running, the cached rating is the stored one.
        confirmed: running ? running.confirmed : (ratingOf() ?? message.rating),
      });
      await queryClient.cancelQueries({ queryKey: key });
      setRating(rating);
      return { save };
    },
    onSuccess: (_data, rating) => {
      // One toast per message however fast the clicks: the id replaces it.
      if (rating !== 0) {
        toast.success("Thanks for the feedback", { id: `copilot-rating-${message.id}` });
      }
      const running = ratingSaves.get(message.id);
      if (running) running.confirmed = rating;
    },
    onError: (error, _rating, context) => {
      // Only this message's rating: restoring the whole session would undo
      // another message's rating that saved meanwhile. A newer click on this
      // message since then keeps its rating.
      const running = ratingSaves.get(message.id);
      if (running && running.latest === context?.save) {
        setRating(running.confirmed);
      }
      toast.error("Could not save your rating", { description: error.message });
    },
    onSettled: (_data, _error, _rating, context) => {
      if (ratingSaves.get(message.id)?.latest === context?.save) {
        ratingSaves.delete(message.id);
      }
    },
  });

  const toggle = (value: -1 | 1) => {
    rate.mutate((ratingOf() ?? message.rating) === value ? 0 : value);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Good answer"
        aria-pressed={message.rating === 1}
        title="Good answer"
        onClick={() => {
          toggle(1);
        }}
      >
        <ThumbsUp aria-hidden className={message.rating === 1 ? "fill-current" : undefined} />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Poor answer"
        aria-pressed={message.rating === -1}
        title="Poor answer"
        onClick={() => {
          toggle(-1);
        }}
      >
        <ThumbsDown aria-hidden className={message.rating === -1 ? "fill-current" : undefined} />
      </Button>
    </>
  );
}

/**
 * A model id without its provider prefix ("Qwen/Qwen3.6-35B-A3B" reads
 * "Qwen3.6-35B-A3B"); the full id stays in the label's title.
 */
export function shortModelName(model: string): string {
  return model.slice(model.lastIndexOf("/") + 1) || model;
}

function AssistantAvatar() {
  return (
    <MessageAvatar>
      <span className="flex size-8 items-center justify-center bg-primary/10 text-primary dark:bg-primary/25 dark:text-link">
        <Bot className="size-4" aria-hidden />
      </span>
    </MessageAvatar>
  );
}

const attachmentIcons: Record<CopilotAttachmentInfo["type"], React.ReactNode> = {
  image: <ImageIcon aria-hidden />,
  file: <Paperclip aria-hidden />,
  pdf: <FileText aria-hidden />,
  execution: <Zap aria-hidden />,
};

const attachmentKinds: Record<CopilotAttachmentInfo["type"], string> = {
  image: "Image",
  file: "File",
  pdf: "PDF",
  execution: "Note",
};

/** The files a question carried (names only; the content is not kept). */
function AttachmentList({ attachments }: { attachments: CopilotAttachmentInfo[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-end gap-1.5" aria-label="Attached">
      {attachments.map((attachment, index) => (
        <li
          key={index}
          className="flex max-w-56 items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0"
          title={attachment.name}
        >
          {attachmentIcons[attachment.type]}
          <span className="sr-only">{attachmentKinds[attachment.type]}: </span>
          <span className="truncate">{attachment.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function CopilotUserMessage({
  content,
  answers = [],
  attachments = [],
  onRetry,
  latest = true,
}: {
  content: string;
  /** Answers to an agent's questions, shown instead of `content`. */
  answers?: CopilotClarificationAnswer[];
  attachments?: CopilotAttachmentInfo[];
  onRetry?: () => void;
  /** The newest question keeps its actions shown; older ones show on hover. */
  latest?: boolean;
}) {
  return (
    <Message align="end">
      <MessageContent>
        <AttachmentList attachments={attachments} />
        <Bubble>
          <BubbleContent>
            {answers.length > 0 ? (
              <span className="flex flex-col gap-1.5">
                <span className="text-xs font-medium opacity-80">Your answers</span>
                {answers.map(({ question, answer }, index) => (
                  <span key={index} className="flex flex-col">
                    <span className="text-xs opacity-80">{question}</span>
                    <span>{answer}</span>
                  </span>
                ))}
              </span>
            ) : (
              // Plain text: a pasted FASTA header (">seq1") must stay as typed.
              <span className="whitespace-pre-wrap">{content}</span>
            )}
          </BubbleContent>
        </Bubble>
        <MessageFooter reveal={latest ? "always" : "hover"}>
          {answers.length === 0 && <CopyButton text={content} />}
          {onRetry && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Ask again"
              title="Ask again"
              onClick={onRetry}
            >
              <RotateCcw aria-hidden />
            </Button>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

/** A stored answer: markdown, what the agents did, and its actions. */
export function CopilotAssistantMessage({
  sessionId,
  message,
  interactive = false,
  latest = true,
  showModel = true,
}: {
  sessionId: string;
  message: CopilotMessage;
  /** Its card takes answers (the newest answer, with nothing after it). */
  interactive?: boolean;
  /** The newest answer keeps its actions shown; older ones show on hover. */
  latest?: boolean;
  /** Name the model (the transcript names it only where it changes). */
  showModel?: boolean;
}) {
  return (
    <Message>
      <AssistantAvatar />
      <MessageContent>
        <Bubble variant="ghost">
          <BubbleContent>
            <div className="flex flex-col gap-2">
              <CopilotSteps steps={message.steps} />
              {message.content && <CopilotMarkdown content={message.content} />}
              {message.card && (
                <MessageCard
                  messageId={message.id}
                  card={message.card}
                  interactive={interactive}
                />
              )}
            </div>
          </BubbleContent>
        </Bubble>
        <MessageFooter reveal={latest ? "always" : "hover"}>
          {message.content && <CopyButton text={message.content} />}
          {message.persisted && !message.systemInitiated && (
            <RatingButtons sessionId={sessionId} message={message} />
          )}
          {message.model && showModel && (
            <span className="ml-1 truncate text-2xs font-normal" title={message.model}>
              {shortModelName(message.model)}
            </span>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

/** The answer being written: live status, steps so far, and the text. */
export function CopilotStreamingMessage({
  steps,
  answer,
  card,
  live,
}: {
  steps: CopilotStep[];
  answer: string;
  card: CopilotCard | null;
  /** The live status line, while the turn runs. */
  live: React.ReactNode;
}) {
  return (
    <Message>
      <AssistantAvatar />
      <MessageContent>
        <Bubble variant="ghost">
          <BubbleContent>
            <div className="flex flex-col gap-2">
              <CopilotSteps steps={steps} />
              {answer && <CopilotMarkdown content={answer} />}
              {/* Answerable once saved: the stored answer replaces this one. */}
              {card && (
                <MessageCard messageId="" card={card} interactive={false} live />
              )}
              {live}
            </div>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
