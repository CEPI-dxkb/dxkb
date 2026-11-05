"use client";

import { CircleCheck, CirclePause, CircleX, MessageSquareText, Send } from "lucide-react";
import { createContext, useContext, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actionKind,
  executionQuestion,
  executionYesLabel,
  type CopilotClarificationCard,
  type CopilotExecutionCard,
} from "@/lib/copilot/cards";
import type { CopilotClarificationAnswer } from "@/lib/copilot/types";

/**
 * What the cards can do; provided by the panel that sends turns. Each
 * resolves to whether the answer went through, so a refused one (another tab
 * answered first, a turn is running) leaves the card answerable.
 */
export interface CopilotCardActions {
  answerQuestions: (
    messageId: string,
    card: CopilotClarificationCard,
    answers: CopilotClarificationAnswer[],
  ) => Promise<boolean>;
  /** Yes: run the prepared actions once, exactly as prepared. */
  runActions: (messageId: string, card: CopilotExecutionCard) => Promise<boolean>;
  /** No: record the answer; nothing runs. */
  declineActions: (messageId: string, card: CopilotExecutionCard) => Promise<boolean>;
  /** Other: ask the agent to change the prepared actions. */
  reviseActions: (
    messageId: string,
    card: CopilotExecutionCard,
    change: string,
  ) => Promise<boolean>;
}

const CardActionsContext = createContext<CopilotCardActions | null>(null);
export const CopilotCardActionsProvider = CardActionsContext.Provider;

function useCardActions(): CopilotCardActions | null {
  return useContext(CardActionsContext);
}

function CardFrame({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm">
      <h4 className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * An agent's questions before it goes on: option chips plus a free-text
 * answer per question. Answers go back to the agent that asked. Only the
 * newest unanswered card takes answers; older ones show their questions.
 */
export function ClarificationCardView({
  messageId,
  card,
  interactive,
}: {
  messageId: string;
  card: CopilotClarificationCard;
  interactive: boolean;
}) {
  const actions = useCardActions();
  const formId = useId();
  const [answers, setAnswers] = useState<Partial<Record<string, string>>>({});
  const [typed, setTyped] = useState<Partial<Record<string, string>>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const canAnswer = interactive && !sent && actions !== null;

  const choose = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setTyped((current) => ({ ...current, [id]: "" }));
    setMissing((current) => current.filter((item) => item !== id));
  };

  const submit = () => {
    if (!actions) return;
    const unanswered = card.questions.filter(
      (question) => question.required && !answers[question.id]?.trim(),
    );
    if (unanswered.length > 0) {
      setMissing(unanswered.map((question) => question.id));
      return;
    }
    const given = card.questions.flatMap((question) => {
      const answer = answers[question.id]?.trim();
      return answer ? [{ question: question.question, answer }] : [];
    });
    if (given.length === 0) {
      setMissing(card.questions.map((question) => question.id));
      return;
    }
    setSent(true);
    void actions.answerQuestions(messageId, card, given).then((ok) => {
      if (!ok) setSent(false);
    });
  };

  return (
    <CardFrame
      icon={<MessageSquareText />}
      title={
        card.agent === "planning"
          ? "Before I create a plan, I have a few questions"
          : "Before I go on, I have a few questions"
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {card.questions.map((question) => {
          const isMissing = missing.includes(question.id);
          const labelId = `${formId}-${question.id}`;
          return (
            <fieldset
              key={question.id}
              aria-labelledby={labelId}
              className="flex flex-col gap-2"
            >
              <p id={labelId} className="font-medium">
                {question.question}
                {question.required && <span className="text-destructive"> *</span>}
              </p>
              {question.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option && !typed[question.id];
                    return (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        aria-pressed={selected}
                        disabled={!canAnswer}
                        onClick={() => {
                          choose(question.id, option);
                        }}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
              )}
              {canAnswer && (
                <Input
                  value={typed[question.id] ?? ""}
                  placeholder={
                    question.options.length > 0 ? "Or type your own answer…" : "Your answer…"
                  }
                  aria-label={`Your answer to: ${question.question}`}
                  aria-invalid={isMissing || undefined}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTyped((current) => ({ ...current, [question.id]: value }));
                    setAnswers((current) => ({ ...current, [question.id]: value }));
                    if (value.trim()) {
                      setMissing((current) => current.filter((item) => item !== question.id));
                    }
                  }}
                />
              )}
            </fieldset>
          );
        })}
        {missing.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            {missing.length === 1
              ? `Please answer: ${card.questions.find((question) => question.id === missing[0])?.question ?? "the highlighted question"}`
              : `Please answer the ${String(missing.length)} required questions.`}
          </p>
        )}
        {canAnswer ? (
          <div>
            <Button type="submit" size="sm">
              <Send aria-hidden />
              Send answers
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {sent ? "Answers sent." : "These questions were answered below."}
          </p>
        )}
      </form>
    </CardFrame>
  );
}

function ExecutionAnswered({ card }: { card: CopilotExecutionCard }) {
  if (!card.answered) return null;
  if (card.answered.answer === "yes") {
    return (
      <p className="flex items-center gap-1.5 text-success">
        <CircleCheck className="size-4" aria-hidden />
        Sent. See the reply below and your Jobs list.
      </p>
    );
  }
  if (card.answered.answer === "no") {
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <CircleX className="size-4" aria-hidden />
        Not submitted.
      </p>
    );
  }
  return (
    <p className="text-muted-foreground">
      Changed: &ldquo;{card.answered.text ?? ""}&rdquo;. See the new set below.
    </p>
  );
}

function ChangeForm({
  label,
  placeholder,
  autoFocus = false,
  onSend,
}: {
  label: string;
  placeholder: string;
  autoFocus?: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const change = text.trim();
        if (change) onSend(change);
      }}
    >
      <Input
        value={text}
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
        Send
      </Button>
    </form>
  );
}

/**
 * Actions an agent prepared but did not run (Plan mode, or a set of jobs,
 * which is always confirmed). One question, three answers: Yes runs them once
 * exactly as prepared; No records the answer and runs nothing; a typed change
 * asks the agent to revise the set, which never submits.
 */
export function ExecutionCardView({
  messageId,
  card,
  interactive,
}: {
  messageId: string;
  card: CopilotExecutionCard;
  interactive: boolean;
}) {
  const actions = useCardActions();
  // "No" in this visit: asks whether anything should change.
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const canAnswer = interactive && actions !== null && !busy;
  const count = card.actions.length;
  // A refused answer leaves the question open; a sent one waits for the
  // stored card, which comes back answered.
  const settle = (ok: boolean) => {
    if (!ok) setBusy(false);
  };

  return (
    <CardFrame icon={<CirclePause />} title="Prepared — nothing submitted yet">
      <p className="text-muted-foreground">
        {count === 1
          ? "The Copilot prepared this and did not run it:"
          : `The Copilot prepared these ${String(count)} and did not run them:`}
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        {card.actions.map((action, index) => (
          <li key={index}>
            <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-2xs font-medium uppercase">
              {actionKind(action.tool)}
            </span>
            {typeof action.summary === "string" && action.summary ? action.summary : action.tool}
          </li>
        ))}
      </ol>

      {card.answered ? (
        <>
          <ExecutionAnswered card={card} />
          {card.answered.answer === "no" && declined && canAnswer && (
            <div className="flex flex-col gap-2">
              <p className="font-medium">Should anything be changed?</p>
              <ChangeForm
                autoFocus
                label="Describe the change"
                placeholder="Describe the change, or leave it…"
                onSend={(change) => {
                  setBusy(true);
                  void actions.reviseActions(messageId, card, change).then(settle);
                }}
              />
            </div>
          )}
        </>
      ) : canAnswer ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{executionQuestion(card.actions)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setBusy(true);
                void actions.runActions(messageId, card).then(settle);
              }}
            >
              {executionYesLabel(card.actions)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBusy(true);
                void actions.declineActions(messageId, card).then((recorded) => {
                  setBusy(false);
                  if (recorded) setDeclined(true);
                });
              }}
            >
              No
            </Button>
          </div>
          <ChangeForm
            label="Or describe a change"
            placeholder="Or describe a change (e.g. drop the second job)…"
            onSend={(change) => {
              setBusy(true);
              void actions.reviseActions(messageId, card, change).then(settle);
            }}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {busy ? "Sending…" : "This question can be answered on the newest message only."}
        </p>
      )}
    </CardFrame>
  );
}
