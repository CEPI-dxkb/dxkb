"use client";

import { MessageSquareText, Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CopilotClarificationCard } from "@/lib/copilot/cards";
import { useCardActions } from "./copilot-card-actions";
import { CardFrame } from "./copilot-card-frame";

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
  const [noneAnswered, setNoneAnswered] = useState(false);
  const [sent, setSent] = useState(false);
  const canAnswer = interactive && !sent && actions !== null;

  const choose = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setTyped((current) => ({ ...current, [id]: "" }));
    setMissing((current) => current.filter((item) => item !== id));
    setNoneAnswered(false);
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
      setNoneAnswered(true);
      return;
    }
    setNoneAnswered(false);
    setSent(true);
    void actions.answerQuestions(messageId, card, given).then((ok) => {
      if (!ok) setSent(false);
    });
  };

  const missingIds = new Set(missing);

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
          const isMissing = missingIds.has(question.id);
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
                      setNoneAnswered(false);
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
              : `Please answer the ${String(missing.length)} highlighted questions.`}
          </p>
        )}
        {noneAnswered && missing.length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            Answer at least one question.
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
