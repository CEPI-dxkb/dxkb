import { test, expect, applyBackendMocks } from "../mocks/backends";
import type { JsonOverride } from "../mocks/backends";
import { CopilotPage } from "../pages";
import {
  copilotOverrides,
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { copilotName } from "@/lib/copilot/name";

const question = "Find complete Mpox virus genomes collected since 2022";
const answer = "I found **12** complete Mpox genomes.";

/** One streamed turn as the gateway sends it, passed through by the route. */
const turnFrames = [
  ": connected\n\n",
  'event: started\ndata: {"job_id":"e2e-job"}\n\n',
  'event: progress\ndata: {"step_id":"s1","phase":"tool","status":"done","label":"Searched Mpox genomes","result":"12 found","took_ms":900}\n\n',
  `event: final_response\ndata: ${JSON.stringify({ chunk: answer })}\n\n`,
  'event: done\ndata: {"job_id":"e2e-job"}\n\n',
].join("");

/**
 * The chat stream, and the stored session that reads back empty until the
 * question was sent and with the saved turn after.
 */
function chatOverrides(): { overrides: JsonOverride[]; sent: unknown[] } {
  const sent: unknown[] = [];
  const overrides: JsonOverride[] = [
    {
      url: /\/api\/copilot\/chat$/,
      method: "POST",
      contentType: "text/event-stream",
      body: ({ parsedBody }) => {
        sent.push(parsedBody);
        return turnFrames;
      },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+\/title$/,
      method: "POST",
      body: { title: "Mpox genome search" },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+(?:\?|$)/,
      method: "GET",
      body: () => ({
        sessionId: "e2e-session",
        executionMode: "plan",
        activeJobId: null,
        messages:
          sent.length === 0
            ? []
            : [
                {
                  id: "u1",
                  role: "user",
                  content: question,
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
                },
                {
                  id: "a1",
                  role: "assistant",
                  content: answer,
                  timestamp: null,
                  model: "e2e-model",
                  steps: [
                    {
                      stepId: "s1",
                      phase: "tool",
                      status: "done",
                      label: "Searched Mpox genomes",
                      detail: null,
                      result: "12 found",
                      agentLabel: null,
                      tookMs: 900,
                      transient: false,
                    },
                  ],
                  card: null,
                  rating: null,
                  persisted: true,
                  systemInitiated: false,
                  isClarification: false,
                  clarificationAnswers: [],
                  attachments: [],
                },
              ],
      }),
    },
  ];
  return { overrides, sent };
}

/** A stored message in the shape `/api/copilot/sessions/[id]` answers with. */
function storedMessage(fields: Record<string, unknown>) {
  return {
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

/**
 * A chat holding a two-step plan, with the gateway's side simulated: each
 * step turn reports the step running and done (the first also submits a job),
 * and the stored plan follows, as the gateway stores step updates and plan
 * saves. Records the turns and plan saves the page sends.
 */
function planChat() {
  const turns: Record<string, unknown>[] = [];
  const saves: Record<string, unknown>[] = [];
  let plan: Record<string, unknown> = {
    plan_id: "p1",
    title: "Assemble and annotate SRR123456",
    description: "Two steps",
    status: "draft",
    steps: [
      { step_id: "step_1", description: "Assemble the reads", agent: "service", reasoning: "r", depends_on: [], status: "pending" },
      { step_id: "step_2", description: "Annotate the assembly", agent: "service", reasoning: "r", depends_on: ["step_1"], status: "pending" },
    ],
  };
  const setStep = (index: number, status: string) => {
    const steps = (plan.steps as Record<string, unknown>[]).slice();
    steps[index] = { ...steps[index], status, result_summary: status === "completed" ? `Step ${String(index + 1)} done` : undefined };
    plan = { ...plan, steps };
  };
  const overrides: JsonOverride[] = [
    {
      url: /\/api\/copilot\/chat$/,
      method: "POST",
      contentType: "text/event-stream",
      body: ({ parsedBody }) => {
        const turn = parsedBody as { planStep?: { stepIndex: number } };
        turns.push(parsedBody as Record<string, unknown>);
        const index = turn.planStep?.stepIndex ?? 0;
        const event = (name: string, data: object) =>
          `event: ${name}\ndata: ${JSON.stringify({ plan_id: "p1", step_id: `step_${String(index + 1)}`, step_index: index, ...data })}\n\n`;
        setStep(index, "completed");
        return [
          event("plan_step_started", {}),
          ...(index === 0 ? [event("plan_workflow_submitted", { submission_ids: ["sub-1"] })] : []),
          event("plan_step_completed", { result_summary: `Step ${String(index + 1)} done` }),
          `event: final_response\ndata: ${JSON.stringify({ chunk: `Finished step ${String(index + 1)}.` })}\n\n`,
          "event: done\ndata: {}\n\n",
        ].join("");
      },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+\/plans\/p1$/,
      method: "PUT",
      status: 204,
      body: ({ parsedBody }) => {
        const saved = (parsedBody as { plan: Record<string, unknown> }).plan;
        saves.push(saved);
        plan = structuredClone(saved);
        return "";
      },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+\/workflow-watches$/,
      method: "GET",
      body: { watches: [{ submissionId: "sub-1", workflowId: "w1", status: "completed" }] },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+(?:\?|$)/,
      method: "GET",
      body: () => ({
        sessionId: "e2e-session",
        executionMode: "plan",
        activeJobId: null,
        messages: [
          storedMessage({ id: "u1", role: "user", content: "Assemble and annotate SRR123456" }),
          storedMessage({
            id: "a1",
            role: "assistant",
            content: "Here is a plan.",
            card: { cardType: "plan", payload: plan },
          }),
          ...turns.map((turn, index) =>
            storedMessage({
              id: `step-answer-${String(index)}`,
              role: "assistant",
              content: `Finished step ${String(((turn.planStep as { stepIndex: number } | undefined)?.stepIndex ?? 0) + 1)}.`,
            }),
          ),
        ],
      }),
    },
  ];
  return { overrides, turns, saves };
}

const preparedJob = {
  tool: "submit_gowe_job",
  summary: "Genome assembly of SRR123456 (unicycler)",
  arguments: { app_name: "GenomeAssembly2" },
};

/**
 * A chat whose last answer carries `card`; records every chat turn and
 * execution answer the page sends.
 */
function cardChat(card: { card_type: string; card_payload: unknown }) {
  const turns: Record<string, unknown>[] = [];
  const declines: unknown[] = [];
  const overrides: JsonOverride[] = [
    {
      url: /\/api\/copilot\/chat$/,
      method: "POST",
      contentType: "text/event-stream",
      body: ({ parsedBody }) => {
        turns.push(parsedBody as Record<string, unknown>);
        return 'event: final_response\ndata: {"chunk":"Done."}\n\nevent: done\ndata: {}\n\n';
      },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+\/execution-answer$/,
      method: "POST",
      status: 204,
      body: ({ parsedBody }) => {
        declines.push(parsedBody);
        return "";
      },
    },
    {
      url: /\/api\/copilot\/sessions\/[^/?]+(?:\?|$)/,
      method: "GET",
      body: {
        sessionId: "e2e-session",
        executionMode: "plan",
        activeJobId: null,
        messages: [
          storedMessage({ id: "u1", role: "user", content: "Assemble SRR123456" }),
          storedMessage({
            id: "a1",
            role: "assistant",
            content: "",
            card: { cardType: card.card_type, payload: card.card_payload },
          }),
        ],
      },
    },
  ];
  return { overrides, turns, declines };
}

const allOverrides = [
  ...copilotOverrides,
  ...workspacePopulatedOverrides,
  ...journeyOverrides,
];

test.describe("Copilot", () => {
  test("answers a question in the side panel, with what it did", async ({ page }) => {
    const chat = chatOverrides();
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();
    await expect(copilot.emptyState).toBeVisible();

    // A suggestion fills the box; Enter sends it.
    await copilot.suggestion(question).click();
    await expect(copilot.composer).toHaveValue(question);
    await copilot.composer.press("Enter");

    await expect(copilot.answerText("I found")).toBeVisible();
    await expect(copilot.boldAnswer).toHaveText("12");
    await expect(copilot.whatIDidTrigger).toBeVisible();
    await expect(copilot.goodAnswerButton).toBeVisible();
    await expect(copilot.composer).toHaveValue("");

    expect(chat.sent).toEqual([
      expect.objectContaining({
        query: question,
        model: "e2e-model",
        pageContext: expect.stringContaining("their list of submitted jobs"),
      }),
    ]);
  });

  test("keeps the conversation when moved to the floating window", async ({ page }) => {
    const chat = chatOverrides();
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();
    await copilot.ask(question);
    await expect(copilot.answerText("I found")).toBeVisible();

    await copilot.moveToFloating();

    await expect(copilot.panel.getByText("I found")).toBeVisible();
    // Non-modal: the page behind stays usable.
    await expect(copilot.closeButton).toBeVisible();
    await copilot.pressEscape();
    await expect(copilot.panel).toBeHidden();
  });

  test("moves from the floating window back to the side panel", async ({ page }) => {
    await applyBackendMocks(page, { overrides: allOverrides });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();
    await copilot.moveToFloating();
    await expect(copilot.newChatDialog).toHaveAttribute("aria-modal", "false");

    await copilot.moveToSidePanel();

    await expect(copilot.sideSheet).toBeVisible();
    await expect(copilot.sideSheet.getByText(`Ask ${copilotName}`)).toBeVisible();
    await expect(copilot.floating).toHaveCount(0);
  });

  test("resizes the floating window from an edge and a corner", async ({ page }) => {
    await applyBackendMocks(page, { overrides: allOverrides });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();
    await copilot.moveToFloating();
    // The side panel animates closed after the switch, and its backdrop
    // covers the page until it is gone; a press before that lands on it.
    await copilot.waitForFloatingSettled();
    const before = await copilot.floatingBox();

    // Left edge out by 60: wider, right edge fixed.
    await copilot.dragHandle("w", -60, 0);
    const wider = await copilot.floatingBox();
    expect(wider.width).toBeCloseTo(before.width + 60, 0);
    expect(wider.x + wider.width).toBeCloseTo(before.x + before.width, 0);

    // Bottom-right corner in by (40, 50): narrower and shorter, top-left fixed.
    await copilot.dragHandle("se", -40, -50);
    const smaller = await copilot.floatingBox();
    expect(smaller.width).toBeCloseTo(before.width + 20, 0);
    expect(smaller.height).toBeCloseTo(before.height - 50, 0);
    expect(smaller.x).toBeCloseTo(wider.x, 0);
    expect(smaller.y).toBeCloseTo(before.y, 0);
  });

  test("answers an agent's questions from its card", async ({ page }) => {
    const chat = cardChat({
      card_type: "clarification",
      card_payload: {
        agent: "planning",
        questions: [
          { id: "assembler", question: "Which assembler?", options: ["Unicycler", "SPAdes"], required: true },
          { id: "note", question: "Anything else?", options: [] },
        ],
      },
    });
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await expect(copilot.clarificationIntro).toBeVisible();
    // A required question must be answered first.
    await copilot.sendAnswersButton.click();
    await expect(copilot.missingAnswerAlert).toHaveText("Please answer: Which assembler?");

    await copilot.option("SPAdes").click();
    await copilot.answerQuestion("Anything else?", "Keep contigs over 500 bp");
    await copilot.sendAnswersButton.click();

    await expect.poll(() => chat.turns.length).toBe(1);
    expect(chat.turns[0]).toEqual(
      expect.objectContaining({
        query: "Assemble SRR123456",
        targetAgent: "planning",
        executionMode: "plan",
        clarification: {
          originalQuery: "Assemble SRR123456",
          answers: [
            { question: "Which assembler?", answer: "SPAdes" },
            { question: "Anything else?", answer: "Keep contigs over 500 bp" },
          ],
        },
      }),
    );
  });

  test("runs a prepared job once from its card", async ({ page }) => {
    const chat = cardChat({
      card_type: "execution_blocked",
      card_payload: { agent: "service", blocked_actions: [preparedJob] },
    });
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await expect(copilot.preparedNotice).toBeVisible();
    await expect(copilot.answerText("Genome assembly of SRR123456 (unicycler)")).toBeVisible();
    await expect(copilot.submitQuestion).toBeVisible();
    await copilot.submitButton.click();

    await expect.poll(() => chat.turns.length).toBe(1);
    expect(chat.turns[0]).toEqual(
      expect.objectContaining({
        query: expect.stringContaining("Submit the job exactly as you prepared it"),
        replayActions: [preparedJob],
        targetAgent: "service",
      }),
    );
    expect(chat.turns[0]).not.toHaveProperty("preparedActions");
  });

  test("declines a prepared job, then asks what to change", async ({ page }) => {
    const chat = cardChat({
      card_type: "execution_blocked",
      card_payload: { agent: "service", blocked_actions: [preparedJob] },
    });
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await copilot.decline();
    await expect(copilot.notSubmittedNotice).toBeVisible();
    expect(chat.declines).toEqual([{ actions: [preparedJob] }]);
    expect(chat.turns).toEqual([]);

    await expect(copilot.changePrompt).toBeVisible();
    await copilot.describeChange("use SPAdes instead");

    await expect.poll(() => chat.turns.length).toBe(1);
    expect(chat.turns[0]).toEqual(
      expect.objectContaining({
        query: "use SPAdes instead",
        preparedActions: [preparedJob],
        targetAgent: "service",
      }),
    );
  });

  test("sends questions in Execute mode once it is switched on", async ({ page }) => {
    const chat = chatOverrides();
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await expect(copilot.modeRadio("Plan")).toHaveAttribute("aria-checked", "true");
    await copilot.modeRadio("Execute").click();
    await expect(copilot.executeNotice).toBeVisible();

    await copilot.ask(question);
    await expect.poll(() => chat.sent.length).toBe(1);
    expect(chat.sent[0]).toEqual(expect.objectContaining({ executionMode: "execute" }));
  });

  test("runs a plan step by step, waiting for the job a step submitted", async ({ page }) => {
    const chat = planChat();
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await expect(copilot.planHeading("Assemble and annotate SRR123456")).toBeVisible();
    await expect(copilot.draftBadge).toBeVisible();
    await copilot.runPlanButton.click();

    // Step 1 runs, submits a job, and the plan waits for it.
    await expect(copilot.continuePlanButton).toBeVisible();
    await expect(copilot.answerText("The job finished.")).toBeVisible();
    await expect(copilot.answerText("Step 1 done")).toBeVisible();
    // A step's question is not shown as the user's.
    await expect(copilot.planStepQuestion).toHaveCount(0);

    await copilot.continuePlanButton.click();
    await expect(copilot.allStepsDone).toBeVisible();

    expect(chat.turns).toEqual([
      expect.objectContaining({
        query: "Execute plan step: Assemble the reads",
        targetAgent: "planning",
        planStep: expect.objectContaining({ stepIndex: 0 }),
      }),
      expect.objectContaining({
        query: "Execute plan step: Annotate the assembly",
        planStep: expect.objectContaining({ stepIndex: 1 }),
      }),
    ]);
    // The completed status is saved just after the last step reads back done.
    await expect.poll(() => chat.saves.length).toBe(4);
    expect(chat.saves.map((plan) => plan.status)).toEqual([
      "executing",
      "executing",
      "executing",
      "completed",
    ]);
    // The wait was saved after step 1, and cleared by Continue.
    expect(chat.saves[1]).toHaveProperty("_waitingForWorkflows", { "sub-1": { status: "active" } });
    expect(chat.saves[2]).not.toHaveProperty("_waitingForWorkflows");
  });

  test("edits a draft plan's steps before it runs", async ({ page }) => {
    const chat = planChat();
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await copilot.editPlanButton.click();
    // Step 2 depends on step 1, so it cannot move above it.
    await expect(copilot.moveStepUp(2)).toBeDisabled();

    await copilot.stepBox(2).fill("Annotate with RASTtk");
    await copilot.addStepButton.click();
    await copilot.stepBox(3).fill("Report the results");
    await copilot.moveStepUp(3).click();
    await copilot.saveChangesButton.click();

    await expect(copilot.runPlanButton).toBeVisible();
    expect(chat.saves).toHaveLength(1);
    expect(chat.saves[0].steps).toEqual([
      expect.objectContaining({ step_id: "step_1", description: "Assemble the reads" }),
      expect.objectContaining({ step_id: "step_3", description: "Report the results" }),
      expect.objectContaining({ step_id: "step_2", description: "Annotate with RASTtk", depends_on: ["step_1"] }),
    ]);
  });

  test("sends an attached text file with the question", async ({ page }) => {
    const chat = chatOverrides();
    await applyBackendMocks(page, { overrides: [...chat.overrides, ...allOverrides] });
    const copilot = new CopilotPage(page);
    await copilot.gotoAndOpen();

    await copilot.attach({
      name: "ids.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("SRR123456\nSRR654321\n"),
    });
    await expect(copilot.attachedFiles).toContainText("ids.txt");
    await copilot.composer.fill("Assemble these runs");
    await copilot.send();

    await expect.poll(() => chat.sent.length).toBe(1);
    expect(chat.sent[0]).toEqual(
      expect.objectContaining({
        query: "Assemble these runs",
        files: [{ name: "ids.txt", content: "SRR123456\nSRR654321\n", mimeType: "text/plain", size: 20 }],
      }),
    );
    await expect(copilot.attachedFiles).toHaveCount(0);
  });

  test("full page shows the chat list beside an empty chat", async ({ page }) => {
    await applyBackendMocks(page, { overrides: allOverrides });
    const copilot = new CopilotPage(page);
    await copilot.openFullPage();
    await expect(copilot.chatList).toBeVisible();
    await expect(copilot.emptyChatList).toBeVisible();
    await expect(copilot.emptyState).toBeVisible();
    // The navbar button is hidden on the full page.
    await expect(copilot.launcher).toBeHidden();
  });
});
