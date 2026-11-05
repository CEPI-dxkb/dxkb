import { act, renderHook, waitFor } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import type { MockInstance } from "vitest";
import type {
  CopilotChat,
  CopilotSendOptions,
  CopilotSendResult,
} from "@/hooks/copilot/use-copilot-chat";
import { reloadCopilotSession } from "@/hooks/copilot/use-copilot-queries";
import type { CopilotClarificationCard, CopilotExecutionCard } from "@/lib/copilot/cards";
import { copilotQueryKeys } from "@/lib/copilot/client";
import type { CopilotPlanStepUpdate } from "@/lib/copilot/plan";
import { startCopilotTurn, type CopilotTurn } from "@/lib/copilot/turn";
import type { CopilotSessionDetail } from "@/lib/copilot/types";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { useCopilot } from "../copilot-provider";
import { useCopilotActions } from "../use-copilot-actions";

const sessionId = "11111111-2222-3333-4444-555555555555";

const preparedJob = { tool: "submit_gowe_job", summary: "Assemble SRR123456" };

/** The plan as the gateway stores it; plan saves replace it. */
let storedPlanPayload: Record<string, unknown>;
let sessionReads: number;
let planSaves: Record<string, unknown>[];

const twoSteps = [
  { step_id: "step_1", description: "Assemble the reads", agent: "service", depends_on: [], status: "pending" },
  { step_id: "step_2", description: "Annotate the assembly", agent: "service", depends_on: ["step_1"], status: "pending" },
];

function planPayload(steps: Record<string, unknown>[] = twoSteps): Record<string, unknown> {
  return {
    plan_id: "p1",
    title: "Assemble and annotate",
    status: "executing",
    steps,
  };
}

/** The gateway's answer to a session read, held until `release` is called. */
function heldSessionRead() {
  const { promise: released, resolve: release } = Promise.withResolvers<undefined>();
  server.use(
    http.get("*/api/copilot/sessions/:id", async () => {
      sessionReads += 1;
      await released;
      return HttpResponse.json(sessionDetail());
    }),
  );
  return () => {
    release(undefined);
  };
}

function sessionUpdates(queryClient: QueryClient): number {
  return queryClient.getQueryState(copilotQueryKeys.session(sessionId))?.dataUpdateCount ?? 0;
}

function storedMessage(fields: Partial<CopilotSessionDetail["messages"][number]>) {
  return {
    id: "m",
    role: "assistant" as const,
    content: "",
    timestamp: null,
    model: null,
    steps: [],
    card: null,
    rating: null,
    persisted: true,
    systemInitiated: false,
    isClarification: false,
    clarificationAnswers: [],
    attachments: [],
    ...fields,
  };
}

function sessionDetail(): CopilotSessionDetail {
  return {
    sessionId,
    executionMode: "plan",
    activeJobId: null,
    messages: [
      storedMessage({ id: "u1", role: "user", content: "Assemble and annotate SRR123456" }),
      storedMessage({ id: "a1", card: { cardType: "plan", payload: storedPlanPayload } }),
      storedMessage({
        id: "e1",
        card: { cardType: "execution", payload: { blocked_actions: [preparedJob] } },
      }),
    ],
  };
}

/** Sets a step's status in the gateway's stored plan, as a step turn would. */
function gatewayStep(index: number, status: string) {
  const steps = (storedPlanPayload.steps as Record<string, unknown>[]).slice();
  steps[index] = { ...steps[index], status };
  storedPlanPayload = { ...storedPlanPayload, steps };
}

function stepUpdate(changes: Partial<CopilotPlanStepUpdate>): CopilotPlanStepUpdate {
  return {
    planId: "p1",
    stepId: null,
    stepIndex: null,
    status: null,
    resultSummary: null,
    errorMessage: null,
    submissionIds: [],
    ...changes,
  };
}

function sentResult({
  ended = "done",
  planUpdates = [],
  reloadError = null,
}: {
  ended?: CopilotTurn["status"];
  planUpdates?: CopilotPlanStepUpdate[];
  reloadError?: string | null;
} = {}): CopilotSendResult {
  const turn: CopilotTurn = { ...startCopilotTurn("t1", "q"), status: ended, planUpdates };
  return { status: "sent", ended, turn, reloadError };
}

function renderActions(
  send: (options: CopilotSendOptions, queryClient: QueryClient) => Promise<CopilotSendResult>,
) {
  const harness: { queryClient: QueryClient | null } = { queryClient: null };
  const chat = {
    send: vi.fn<CopilotChat["send"]>((options) => {
      if (!harness.queryClient) throw new Error("not rendered");
      return send(options, harness.queryClient);
    }),
    isPlanPaused: () => false,
    pausedPlans: new Set<string>(),
    resumePlan: vi.fn(),
    pausePlan: vi.fn(),
  };
  const copilot = { chat, model: "m" } as unknown as ReturnType<typeof useCopilot>;
  const { result } = renderHook(
    () => ({
      queryClient: useQueryClient(),
      actions: useCopilotActions({ copilot, sessionId, executionMode: "plan" }),
    }),
    { wrapper: createQueryClientWrapper() },
  );
  harness.queryClient = result.current.queryClient;
  result.current.queryClient.setQueryData(copilotQueryKeys.session(sessionId), sessionDetail());
  return { result, send: chat.send };
}

/** A step turn the gateway records: the step completes, then `send` reloads. */
async function completingTurn(
  options: CopilotSendOptions,
  queryClient: QueryClient,
  submissionIds: string[] = [],
): Promise<CopilotSendResult> {
  const index = options.planStep?.stepIndex ?? 0;
  gatewayStep(index, "completed");
  const reloadError = await reloadCopilotSession(queryClient, sessionId);
  return sentResult({
    reloadError,
    planUpdates: [
      stepUpdate({ stepId: `step_${String(index + 1)}`, status: "completed", submissionIds }),
    ],
  });
}

const planStepCard: CopilotClarificationCard = {
  questions: [],
  agent: "planning",
  planStep: { planId: "p1", stepId: "step_1", stepIndex: 0 },
};

const executionCard: CopilotExecutionCard = {
  agent: "service",
  actions: [preparedJob],
  answered: null,
  planId: null,
};

function cachedCardPayload(
  queryClient: QueryClient,
  messageId: string,
): Record<string, unknown> | undefined {
  const detail = queryClient.getQueryData<CopilotSessionDetail>(
    copilotQueryKeys.session(sessionId),
  );
  return detail?.messages.find((message) => message.id === messageId)?.card
    ?.payload as Record<string, unknown> | undefined;
}

let toastError: MockInstance<typeof toast.error>;

beforeEach(() => {
  storedPlanPayload = planPayload();
  sessionReads = 0;
  planSaves = [];
  toastError = vi.spyOn(toast, "error");
  server.use(
    http.get("*/api/copilot/sessions/:id", () => {
      sessionReads += 1;
      return HttpResponse.json(sessionDetail());
    }),
    http.put("*/api/copilot/sessions/:id/plans/:planId", async ({ request }) => {
      const { plan } = (await request.json()) as { plan: Record<string, unknown> };
      planSaves.push(plan);
      storedPlanPayload = plan;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  toastError.mockRestore();
});

describe("runPlan", () => {
  it("stops, with a toast, when the chat could not be reloaded after a step", async () => {
    const { result, send } = renderActions(() =>
      Promise.resolve(sentResult({ reloadError: "boom" })),
    );

    let sent = false;
    await act(async () => {
      sent = await result.current.actions.cardActions.answerQuestions("q1", planStepCard, []);
    });

    expect(sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "The plan stopped: the chat could not be reloaded",
      { description: "boom" },
    );
  });

  it("does not send a step again that the reloaded plan still has pending", async () => {
    const { result, send } = renderActions(() => Promise.resolve(sentResult()));

    await act(async () => {
      await result.current.actions.cardActions.answerQuestions("q1", planStepCard, []);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Step 1 did not report a result, so the plan stopped.",
    );
  });

  it("sends a step once when its turns never report progress", async () => {
    const { result, send } = renderActions(async (_options, queryClient) =>
      sentResult({ reloadError: await reloadCopilotSession(queryClient, sessionId) }),
    );

    await act(async () => {
      await result.current.actions.cardActions.answerQuestions("q1", planStepCard, []);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(sessionReads).toBe(1);
    expect(toastError).toHaveBeenCalledWith(
      "Step 1 did not report a result, so the plan stopped.",
    );
  });

  it("stops after a step that submitted jobs when saving the wait fails", async () => {
    server.use(
      http.put("*/api/copilot/sessions/:id/plans/:planId", () =>
        HttpResponse.json({ error: "The gateway is down" }, { status: 500 }),
      ),
    );
    const { result, send } = renderActions((options, queryClient) =>
      completingTurn(options, queryClient, ["sub-1"]),
    );

    await act(async () => {
      await result.current.actions.cardActions.answerQuestions("q1", planStepCard, []);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Could not save the plan", {
      description: "The gateway is down",
    });
  });

  it("stops after a step that submitted jobs when the saved plan cannot be reloaded", async () => {
    let saved = false;
    server.use(
      http.put("*/api/copilot/sessions/:id/plans/:planId", () => {
        saved = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("*/api/copilot/sessions/:id", () =>
        saved
          ? HttpResponse.json({ error: "The session store is down" }, { status: 500 })
          : HttpResponse.json(sessionDetail()),
      ),
    );
    const { result, send } = renderActions((options, queryClient) =>
      completingTurn(options, queryClient, ["sub-1"]),
    );

    await act(async () => {
      await result.current.actions.cardActions.answerQuestions("q1", planStepCard, []);
    });

    expect(saved).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "The plan was saved, but the chat could not be reloaded",
      { description: "The session store is down" },
    );
  });

  it("runs both steps in order, then saves the plan completed", async () => {
    const { result, send } = renderActions((options, queryClient) =>
      completingTurn(options, queryClient),
    );
    const plan = result.current.actions.planActions;

    act(() => {
      plan.continuePlan({
        planId: "p1",
        title: "Assemble and annotate",
        description: null,
        status: "executing",
        steps: [],
        waitingFor: [],
        raw: {},
      });
    });

    await waitFor(() => {
      expect(planSaves).toHaveLength(1);
    });
    expect(planSaves[0]).toHaveProperty("status", "completed");
    expect(send.mock.calls.map(([options]) => [options.query, options.planStep?.stepIndex])).toEqual([
      ["Execute plan step: Assemble the reads", 0],
      ["Execute plan step: Annotate the assembly", 1],
    ]);
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("runPlan with untrusted step ids", () => {
  it("does not run a finished step again when two steps share an id", async () => {
    storedPlanPayload = planPayload([
      twoSteps[0],
      { ...twoSteps[1], step_id: "step_1", depends_on: [] },
    ]);
    const { result, send } = renderActions((options, queryClient) =>
      completingTurn(options, queryClient),
    );
    const { answerQuestions } = result.current.actions.cardActions;

    await act(async () => {
      await answerQuestions("q1", planStepCard, []);
    });

    // The next step's id names the finished one, so the plan stops there.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].planStep?.stepIndex).toBe(0);

    // Going on from the second step by its index runs that step.
    await act(async () => {
      await answerQuestions(
        "q1",
        { ...planStepCard, planStep: { planId: "p1", stepId: null, stepIndex: 1 } },
        [],
      );
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].planStep?.stepIndex).toBe(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("stops, with a toast, after 30 step turns", async () => {
    storedPlanPayload = planPayload(
      Array.from({ length: 31 }, (_, index) => ({
        step_id: `step_${String(index + 1)}`,
        description: `Step ${String(index + 1)}`,
        agent: "service",
        depends_on: [],
        status: "pending",
      })),
    );
    const { result, send } = renderActions((options, queryClient) =>
      completingTurn(options, queryClient),
    );

    await act(async () => {
      await result.current.actions.cardActions.answerQuestions("q1", planStepCard, []);
    });

    expect(send).toHaveBeenCalledTimes(30);
    expect(toastError).toHaveBeenCalledWith("The plan stopped after 30 steps.");
  });
});

describe("sendQuestion", () => {
  it("says the Copilot is busy, without reading the session again", async () => {
    const toastInfo = vi.spyOn(toast, "info");
    const { result } = renderActions(() => Promise.resolve({ status: "busy" }));

    let outcome: Awaited<ReturnType<typeof result.current.actions.sendQuestion>> | null =
      null;
    await act(async () => {
      outcome = await result.current.actions.sendQuestion("Hi");
    });

    const busy = "The Copilot is still finishing the last answer. Try again in a moment.";
    expect(outcome).toEqual({ sent: false, message: busy });
    expect(toastInfo).toHaveBeenCalledWith(busy);
    expect(sessionReads).toBe(0);
    toastInfo.mockRestore();
  });

  it("gives the refusal's message, and reads the session again", async () => {
    const { result } = renderActions(() =>
      Promise.resolve({ status: "refused", message: "The Copilot did not respond." }),
    );

    let outcome: Awaited<ReturnType<typeof result.current.actions.sendQuestion>> | null =
      null;
    await act(async () => {
      outcome = await result.current.actions.sendQuestion("Hi");
    });

    expect(outcome).toEqual({ sent: false, message: "The Copilot did not respond." });
    await waitFor(() => {
      expect(sessionReads).toBe(1);
    });
  });
});

describe("card actions", () => {
  it("leaves an execution card unanswered when the turn did not finish", async () => {
    const release = heldSessionRead();
    const { result } = renderActions(() => Promise.resolve(sentResult({ ended: "error" })));
    const { queryClient } = result.current;
    const updatesBefore = sessionUpdates(queryClient);

    let handled = true;
    await act(async () => {
      handled = await result.current.actions.cardActions.runActions("e1", executionCard);
    });

    expect(handled).toBe(false);
    // Not marked answered while the stored session is read again; that
    // read then decides how the card shows.
    await waitFor(() => {
      expect(sessionReads).toBe(1);
    });
    expect(sessionUpdates(queryClient)).toBe(updatesBefore);
    expect(cachedCardPayload(queryClient, "e1")).not.toHaveProperty("answered");
    release();
    await waitFor(() => {
      expect(sessionUpdates(queryClient)).toBe(updatesBefore + 1);
    });
  });

  it("marks an execution card answered when the turn finished", async () => {
    const { result } = renderActions(() => Promise.resolve(sentResult()));

    let handled = false;
    await act(async () => {
      handled = await result.current.actions.cardActions.runActions("e1", executionCard);
    });

    expect(handled).toBe(true);
    expect(cachedCardPayload(result.current.queryClient, "e1")).toHaveProperty(
      "answered.answer",
      "yes",
    );
  });

  it("does not go on with the plan when the chat could not be read back", async () => {
    const { result, send } = renderActions(() =>
      Promise.resolve(sentResult({ reloadError: "boom" })),
    );

    let handled = false;
    await act(async () => {
      handled = await result.current.actions.cardActions.runActions("e1", {
        ...executionCard,
        planId: "p1",
      });
    });

    expect(handled).toBe(true);
    expect(cachedCardPayload(result.current.queryClient, "e1")).toHaveProperty(
      "answered.answer",
      "yes",
    );
    // The cached plan is from before the turn: starting its next step from
    // it could re-run the step the jobs belong to.
    expect(send).toHaveBeenCalledTimes(1);
    expect(planSaves).toHaveLength(0);
    expect(toastError).toHaveBeenCalledWith(
      "The plan stopped: the chat could not be reloaded",
      { description: "boom" },
    );
  });

  it("does not mark a revised card answered when the turn was stopped", async () => {
    const release = heldSessionRead();
    const { result } = renderActions(() => Promise.resolve(sentResult({ ended: "stopped" })));
    const { queryClient } = result.current;
    const updatesBefore = sessionUpdates(queryClient);

    let handled = true;
    await act(async () => {
      handled = await result.current.actions.cardActions.reviseActions(
        "e1",
        executionCard,
        "Use SPAdes instead",
      );
    });

    expect(handled).toBe(false);
    await waitFor(() => {
      expect(sessionReads).toBe(1);
    });
    expect(sessionUpdates(queryClient)).toBe(updatesBefore);
    expect(cachedCardPayload(queryClient, "e1")).not.toHaveProperty("answered");
    release();
    await waitFor(() => {
      expect(sessionUpdates(queryClient)).toBe(updatesBefore + 1);
    });
  });

  it.each([-1, 2])(
    "treats a plan step card at index %i with an unknown step id as gone",
    async (stepIndex) => {
      const { result, send } = renderActions(() => Promise.resolve(sentResult()));

      let sent = true;
      await act(async () => {
        sent = await result.current.actions.cardActions.answerQuestions(
          "q1",
          { ...planStepCard, planStep: { planId: "p1", stepId: "step_9", stepIndex } },
          [{ question: "Which assembler?", answer: "SPAdes" }],
        );
      });

      expect(sent).toBe(false);
      expect(send).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith("That plan step is no longer in this chat.");
    },
  );
});
