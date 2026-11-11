"use client";

import { createContext, useContext } from "react";
import type {
  CopilotClarificationCard,
  CopilotExecutionCard,
} from "@/lib/copilot/cards";
import type { CopilotClarificationAnswer } from "@/lib/copilot/types";

/** Each resolves to whether the answer went through; a refused one leaves the card answerable. */
export interface CopilotCardActions {
  answerQuestions: (
    messageId: string,
    card: CopilotClarificationCard,
    answers: CopilotClarificationAnswer[],
  ) => Promise<boolean>;
  runActions: (messageId: string, card: CopilotExecutionCard) => Promise<boolean>;
  declineActions: (messageId: string, card: CopilotExecutionCard) => Promise<boolean>;
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

export function useCardActions(): CopilotCardActions | null {
  return useContext(CardActionsContext);
}
