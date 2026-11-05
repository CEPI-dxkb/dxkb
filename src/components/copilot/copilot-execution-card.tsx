"use client";

import { CirclePause } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  actionKind,
  executionQuestion,
  executionYesLabel,
  type CopilotExecutionCard,
} from "@/lib/copilot/cards";
import { useCardActions } from "./copilot-card-actions";
import { CardFrame } from "./copilot-card-frame";
import { ChangeForm } from "./copilot-change-form";
import { ExecutionAnswered } from "./copilot-execution-answered";

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
  // Owned here, not by the form: the form unmounts while an answer is sent, and
  // the typed change must survive a refused one.
  const [change, setChange] = useState("");
  const canAnswer = interactive && actions !== null && !busy;
  const count = card.actions.length;
  // A refused answer leaves the question open; a sent one waits for the
  // stored card, which comes back answered.
  const settle = (ok: boolean) => {
    if (!ok) setBusy(false);
  };

  const revise = (text: string) => {
    if (!actions) return;
    setBusy(true);
    void actions.reviseActions(messageId, card, text).then((ok) => {
      settle(ok);
      if (ok) setChange("");
    });
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
                value={change}
                onChange={setChange}
                onSend={revise}
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
                  if (recorded) {
                    setDeclined(true);
                    setChange("");
                  }
                });
              }}
            >
              No
            </Button>
          </div>
          <ChangeForm
            label="Or describe a change"
            placeholder="Or describe a change (e.g. drop the second job)…"
            value={change}
            onChange={setChange}
            onSend={revise}
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
