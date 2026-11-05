"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CopilotSendOptions,
  CopilotSendResult,
} from "@/hooks/copilot/use-copilot-chat";
import { reloadCopilotSession } from "@/hooks/copilot/use-copilot-queries";
import { clarificationQuery, executeRunMessage } from "@/lib/copilot/cards";
import {
  copilotQueryKeys,
  declineCopilotExecution,
  saveCopilotPlan,
} from "@/lib/copilot/client";
import { describeCopilotPage } from "@/lib/copilot/page-context";
import {
  copilotPlanObject,
  copilotPlanState,
  planStepQuery,
  readCopilotPlan,
  withStepStatus,
  type CopilotPlan,
  type CopilotPlanStep,
} from "@/lib/copilot/plan";
import type {
  CopilotExecutionMode,
  CopilotSessionDetail,
} from "@/lib/copilot/types";
import type { CopilotCardActions } from "./copilot-cards";
import type { CopilotPlanActions } from "./copilot-plan-card";
import type { useCopilot } from "./copilot-provider";

export type CopilotTurnExtra = Omit<
  CopilotSendOptions,
  "sessionId" | "query" | "model" | "pageContext" | "storedCount"
> & {
  /** The model for this question only (one that reads its images). */
  model?: string;
};

/** The newest plan in a session; only it runs or changes. */
export function newestCopilotPlan(
  detail: CopilotSessionDetail | undefined,
): { messageId: string; plan: CopilotPlan } | null {
  const messages = detail?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.card?.cardType !== "plan") continue;
    const plan = readCopilotPlan(message.card.payload);
    if (plan) return { messageId: message.id, plan };
  }
  return null;
}

/** The most step turns one run sends: the editor's cap on a plan's steps. */
const maxPlanTurns = 30;

/** Why a send did not start while another turn holds this tab. */
const copilotBusyMessage =
  "The Copilot is still finishing the last answer. Try again in a moment.";

/**
 * What became of a question the user typed. `message` says why it was not
 * sent, when that is known (a plan step reply's failures toast their own).
 */
export interface CopilotQuestionResult {
  sent: boolean;
  message: string | null;
}

function errorText(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/**
 * Sending turns for a panel, and what its cards do. A running plan keeps
 * going when the panel closes or changes surface: everything here reads the
 * session from the query cache, not from the render that started it.
 */
export function useCopilotActions({
  copilot,
  sessionId,
  executionMode,
}: {
  copilot: ReturnType<typeof useCopilot>;
  sessionId: string | null;
  executionMode: CopilotExecutionMode;
}) {
  const queryClient = useQueryClient();
  const { chat, model } = copilot;

  const storedSession = (id: string) =>
    queryClient.getQueryData<CopilotSessionDetail>(copilotQueryKeys.session(id));

  /** Reads the open session again without waiting for it. */
  const reloadInBackground = () => {
    if (sessionId) void reloadCopilotSession(queryClient, sessionId);
  };

  /** Sends a turn in the open session. */
  const sendTurn = async (
    query: string,
    extra: CopilotTurnExtra = {},
  ): Promise<CopilotSendResult> => {
    const { model: turnModel = model, ...options } = extra;
    if (!query || !sessionId || !turnModel) {
      return { status: "refused", message: "The Copilot is not ready yet." };
    }
    const result = await chat.send({
      sessionId,
      query,
      model: turnModel,
      executionMode,
      pageContext: describeCopilotPage(
        window.location.pathname,
        window.location.search,
      ),
      storedCount: storedSession(sessionId)?.messages.length ?? 0,
      ...options,
    });
    if (result.status === "busy") {
      // Another turn here holds the tab, or the last one is still being read
      // back; nothing about the stored session changed.
      toast.info(copilotBusyMessage);
    } else if (result.status === "refused") {
      // The stored session shows what actually happened (a card another tab
      // answered, a turn already running).
      reloadInBackground();
    }
    return result;
  };

  /** The stored plan, as the session in the cache has it now. */
  const storedPlan = (planId: string): CopilotPlan | null => {
    if (!sessionId) return null;
    const newest = newestCopilotPlan(storedSession(sessionId));
    return newest?.plan.planId === planId ? newest.plan : null;
  };

  /**
   * Saves a plan and reloads the session. False (with a toast) unless both
   * worked: callers decide from the stored plan, which a failed reload leaves
   * as it was before the save.
   */
  const savePlan = async (
    plan: CopilotPlan,
    changes: Parameters<typeof copilotPlanObject>[1],
  ): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      await saveCopilotPlan(sessionId, plan.planId, copilotPlanObject(plan, changes));
    } catch (error) {
      toast.error("Could not save the plan", { description: errorText(error) });
      reloadInBackground();
      return false;
    }
    const reloadError = await reloadCopilotSession(queryClient, sessionId);
    if (reloadError !== null) {
      toast.error("The plan was saved, but the chat could not be reloaded", {
        description: reloadError,
      });
      return false;
    }
    return true;
  };

  /**
   * Runs plan steps from `stepIndex` until the plan stops: a step fails,
   * asks, waits for approval or for jobs, reports no result, the user pauses
   * it, every step is done, or `maxPlanTurns` turns were sent. `first` replaces the first step's hidden
   * question (a reply to the step's question, shown as the user's message).
   * Resolves, when the plan stops, to whether its first step was sent at all.
   *
   * The next step is carried by id, so a plan edited in another tab between
   * turns cannot shift which step runs, and each turn is decided from the
   * session `send` read back after it.
   */
  const runPlan = async (
    planId: string,
    stepIndex: number,
    first?: { query: string; extra?: CopilotTurnExtra },
  ): Promise<boolean> => {
    let nextStepId: string | null = null;
    let step = first;
    let sent = false;
    for (let turn = 0; turn < maxPlanTurns; turn += 1) {
      const plan = storedPlan(planId);
      if (!plan) return sent;
      // The caller's index is read from this same stored plan; later steps
      // are found by id, as the plan may have changed during the turn.
      const index =
        turn === 0
          ? stepIndex >= 0 && stepIndex < plan.steps.length
            ? stepIndex
            : -1
          : plan.steps.findIndex((candidate) => candidate.stepId === nextStepId);
      if (index === -1) return sent;
      // Only the first turn may re-run a step (a retry, or a reply to its
      // question). A later one that resolves to a settled step means its id
      // is not unique, and the step would run again.
      if (turn > 0 && plan.steps[index].status !== "pending") return sent;
      const sentStepId = plan.steps[index].stepId;
      const result = await sendTurn(step?.query ?? planStepQuery(plan, index), {
        ...step?.extra,
        targetAgent: "planning",
        hidden: !step,
        planStep: {
          plan: copilotPlanObject(withStepStatus(plan, index, "pending"), {
            status: "executing",
          }),
          stepIndex: index,
        },
      });
      step = undefined;
      if (result.status !== "sent") return sent;
      sent = true;
      if (result.ended !== "done") return sent;
      // The stored plan is still the one from before the step.
      if (result.reloadError !== null) {
        toast.error("The plan stopped: the chat could not be reloaded", {
          description: result.reloadError,
        });
        return sent;
      }

      const after = storedPlan(planId);
      if (!after) return sent;
      // Jobs the step submitted: the plan waits for them, saved or not (a
      // failed save toasts, and the card offers to go on).
      const submitted = result.turn.planUpdates.flatMap((update) =>
        update.planId === planId ? update.submissionIds : [],
      );
      if (submitted.length > 0) {
        await savePlan(after, {
          waitingFor: [...new Set([...after.waitingFor, ...submitted])],
        });
        return sent;
      }
      // Sending the step again would repeat whatever it did.
      const sentStep = after.steps.find((candidate) => candidate.stepId === sentStepId);
      if (!sentStep || sentStep.status === "pending") {
        toast.error(
          `Step ${String(index + 1)} did not report a result, so the plan stopped.`,
        );
        return sent;
      }
      const state = copilotPlanState(after);
      if (state.kind === "completed") {
        if (after.status !== "completed") await savePlan(after, { status: "completed" });
        return sent;
      }
      if (state.kind !== "ready" || chat.isPlanPaused(planId)) return sent;
      nextStepId = after.steps[state.stepIndex].stepId;
    }
    toast.error(`The plan stopped after ${String(maxPlanTurns)} steps.`);
    return sent;
  };

  /** Goes on with a plan from wherever it stopped, if it can. */
  const continueStored = async (planId: string) => {
    let plan = storedPlan(planId);
    if (!plan) return;
    if (plan.waitingFor.length > 0) {
      if (!(await savePlan(plan, { waitingFor: [] }))) return;
      plan = storedPlan(planId);
      if (!plan) return;
    }
    const state = copilotPlanState(plan);
    if (state.kind === "completed") {
      if (plan.status !== "completed") await savePlan(plan, { status: "completed" });
      return;
    }
    if (state.kind === "ready") await runPlan(planId, state.stepIndex);
  };

  /** The question a card's answer belongs to: the user message before it. */
  const questionBefore = (messageId: string): string => {
    const messages = (sessionId && storedSession(sessionId)?.messages) || [];
    const index = messages.findIndex((message) => message.id === messageId);
    return (
      messages
        .slice(0, Math.max(index, 0))
        .findLast((message) => message.role === "user" && !message.isClarification)
        ?.content ?? ""
    );
  };

  /** Shows a card as answered before the stored session says so. */
  const markAnswered = (messageId: string, answered: Record<string, unknown>) => {
    if (!sessionId) return;
    queryClient.setQueryData<CopilotSessionDetail>(
      copilotQueryKeys.session(sessionId),
      (detail) =>
        detail && {
          ...detail,
          messages: detail.messages.map((message) =>
            message.id === messageId && message.card
              ? {
                  ...message,
                  card: {
                    ...message.card,
                    payload: {
                      ...(message.card.payload as object),
                      answered: { ...answered, at: new Date().toISOString() },
                    },
                  },
                }
              : message,
          ),
        },
    );
  };

  /**
   * The plan step waiting for a typed reply (it asked a question), or null.
   * A reply in the box then re-runs that step with it.
   */
  const stepAwaitingReply = (): { planId: string; stepIndex: number } | null => {
    if (!sessionId) return null;
    const newest = newestCopilotPlan(storedSession(sessionId));
    if (!newest) return null;
    const state = copilotPlanState(newest.plan);
    if (state.kind !== "waitingForUser") return null;
    return newest.plan.steps[state.stepIndex].status === "needs_input"
      ? { planId: newest.plan.planId, stepIndex: state.stepIndex }
      : null;
  };

  /** Sends what the user typed: a question, or a plan step's reply. */
  const sendQuestion = async (
    query: string,
    extra: CopilotTurnExtra = {},
  ): Promise<CopilotQuestionResult> => {
    const reply = stepAwaitingReply();
    if (reply) {
      chat.resumePlan(reply.planId);
      const sent = await runPlan(reply.planId, reply.stepIndex, { query, extra });
      return { sent, message: null };
    }
    const result = await sendTurn(query, extra);
    if (result.status === "sent") return { sent: true, message: null };
    return {
      sent: false,
      message: result.status === "refused" ? result.message : copilotBusyMessage,
    };
  };

  const cardActions: CopilotCardActions = {
    answerQuestions: async (messageId, card, answers) => {
      if (card.planStep) {
        const { planId } = card.planStep;
        const plan = storedPlan(planId);
        const byId =
          plan?.steps.findIndex((step) => step.stepId === card.planStep?.stepId) ??
          -1;
        const { stepIndex } = card.planStep;
        const index =
          byId !== -1
            ? byId
            : plan && stepIndex !== null && stepIndex >= 0 && stepIndex < plan.steps.length
              ? stepIndex
              : null;
        if (!plan || index === null) {
          toast.error("That plan step is no longer in this chat.");
          return false;
        }
        chat.resumePlan(planId);
        const lines = answers.map(({ question, answer }) => `- ${question} ${answer}`);
        return runPlan(planId, index, {
          query: `My answers to your questions:\n${lines.join("\n")}`,
        });
      }
      const originalQuery = questionBefore(messageId);
      const result = await sendTurn(
        clarificationQuery(card.agent, originalQuery, answers),
        {
          targetAgent: card.agent,
          clarification: { answers, originalQuery },
        },
      );
      return result.status === "sent";
    },
    runActions: async (messageId, card) => {
      const result = await sendTurn(executeRunMessage(card.actions), {
        replayActions: card.actions,
        targetAgent: card.agent ?? undefined,
      });
      if (result.status !== "sent") return false;
      if (result.ended !== "done") {
        // The stored card says whether the gateway took the answer.
        reloadInBackground();
        return false;
      }
      markAnswered(messageId, { answer: "yes" });
      if (result.reloadError !== null) {
        // The cached plan is from before the turn; going on from it could
        // start the wrong step.
        if (card.planId) {
          toast.error("The plan stopped: the chat could not be reloaded", {
            description: result.reloadError,
          });
        }
        return true;
      }
      // A plan step's jobs: once they ran, the plan goes on.
      if (card.planId && !chat.isPlanPaused(card.planId)) {
        void continueStored(card.planId);
      }
      return true;
    },
    declineActions: async (messageId, card) => {
      if (!sessionId) return false;
      try {
        await declineCopilotExecution(sessionId, card.actions);
        markAnswered(messageId, { answer: "no" });
        return true;
      } catch (error) {
        toast.error("Could not record your answer", { description: errorText(error) });
        reloadInBackground();
        return false;
      }
    },
    reviseActions: async (messageId, card, change) => {
      const result = await sendTurn(change, {
        preparedActions: card.actions,
        targetAgent: "service",
      });
      if (result.status !== "sent") return false;
      if (result.ended !== "done") {
        reloadInBackground();
        return false;
      }
      markAnswered(messageId, { answer: "other", text: change });
      return true;
    },
  };

  const planActions: Omit<
    CopilotPlanActions,
    "currentPlanId" | "busy" | "liveUpdates" | "watches"
  > = {
    isPaused: (planId) => chat.pausedPlans.has(planId),
    run: (plan) => {
      chat.resumePlan(plan.planId);
      void (async () => {
        if (!(await savePlan(plan, { status: "executing" }))) return;
        const state = copilotPlanState(storedPlan(plan.planId) ?? plan);
        if (state.kind === "ready") await runPlan(plan.planId, state.stepIndex);
      })();
    },
    continuePlan: (plan) => {
      chat.resumePlan(plan.planId);
      void continueStored(plan.planId);
    },
    pause: (plan) => {
      chat.pausePlan(plan.planId);
    },
    retryStep: (plan, stepIndex) => {
      chat.resumePlan(plan.planId);
      void runPlan(plan.planId, stepIndex);
    },
    skipStep: (plan, stepIndex) => {
      void (async () => {
        if (!(await savePlan(withStepStatus(plan, stepIndex, "skipped"), {}))) return;
        if (!chat.isPlanPaused(plan.planId)) await continueStored(plan.planId);
      })();
    },
    regenerate: (messageId) => {
      const query = questionBefore(messageId);
      if (query) void sendTurn(query);
      else toast.error("The request this plan was made for is not in this chat.");
    },
    saveSteps: (plan, steps: CopilotPlanStep[]) => savePlan(plan, { steps }),
  };

  return { sendTurn, sendQuestion, cardActions, planActions, stepAwaitingReply };
}
