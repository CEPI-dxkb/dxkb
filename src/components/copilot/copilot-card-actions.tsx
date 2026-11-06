"use client";

import { createContext, useContext } from "react";
import type {
  CopilotClarificationCard,
  CopilotExecutionCard,
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

export function CopilotCardActionsProvider({
  value,
  children,
}: {
  value: CopilotCardActions;
  children: React.ReactNode;
}) {
  return <CardActionsContext value={value}>{children}</CardActionsContext>;
}

/** The card actions the panel provides, or null outside one. */
export function useCardActions(): CopilotCardActions | null {
  return useContext(CardActionsContext);
}
