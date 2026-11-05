import { test, expect, applyBackendMocks } from "../mocks/backends";
import type { JsonOverride } from "../mocks/backends";
import {
  copilotOverrides,
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

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
        plan = JSON.parse(JSON.stringify(saved)) as Record<string, unknown>;
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

async function openPanel(page: import("@playwright/test").Page) {
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Open the Copilot" }).click();
}

test.describe("Copilot", () => {
  test("answers a question in the side panel, with what it did", async ({ page }) => {
    const chat = chatOverrides();
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await page.goto("/jobs");

    await page.getByRole("button", { name: "Open the Copilot" }).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Ask the BV-BRC Copilot")).toBeVisible();

    // A suggestion fills the box; Enter sends it.
    await panel.getByRole("button", { name: question }).click();
    const box = panel.getByRole("textbox", { name: "Ask the Copilot" });
    await expect(box).toHaveValue(question);
    await box.press("Enter");

    await expect(panel.getByText("I found")).toBeVisible();
    await expect(panel.getByRole("strong")).toHaveText("12");
    await expect(panel.getByText("What I did (1 step)")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Good answer" })).toBeVisible();
    await expect(box).toHaveValue("");

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
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await page.goto("/jobs");
    await page.getByRole("button", { name: "Open the Copilot" }).click();
    const box = page.getByRole("textbox", { name: "Ask the Copilot" });
    await box.fill(question);
    await box.press("Enter");
    await expect(page.getByText("I found")).toBeVisible();

    await page.getByRole("button", { name: "Copilot options" }).click();
    await page.getByRole("menuitem", { name: "Floating window" }).click();

    const floating = page.getByRole("dialog");
    await expect(floating.getByText("I found")).toBeVisible();
    // Non-modal: the page behind stays usable.
    await expect(page.getByRole("button", { name: "Close the Copilot" }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(floating).toBeHidden();
  });

  test("moves from the floating window back to the side panel", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await page.goto("/jobs");
    await page.getByRole("button", { name: "Open the Copilot" }).click();
    await page.getByRole("button", { name: "Copilot options" }).click();
    await page.getByRole("menuitem", { name: "Floating window" }).click();
    await expect(page.getByRole("dialog", { name: /New chat/ })).toHaveAttribute("aria-modal", "false");

    await page.getByRole("button", { name: "Copilot options" }).click();
    await page.getByRole("menuitem", { name: "Side panel" }).click();

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Ask the BV-BRC Copilot")).toBeVisible();
    await expect(page.locator('[role="dialog"][aria-modal="false"]')).toHaveCount(0);
  });

  test("resizes the floating window from an edge and a corner", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await page.goto("/jobs");
    await page.getByRole("button", { name: "Open the Copilot" }).click();
    await page.getByRole("button", { name: "Copilot options" }).click();
    await page.getByRole("menuitem", { name: "Floating window" }).click();
    const floating = page.locator('[role="dialog"][aria-modal="false"]');
    await expect(floating).toBeVisible();
    // The side panel animates closed after the switch, and its backdrop
    // covers the page until it is gone; a press before that lands on it.
    await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
    await expect(page.getByRole("menu")).toBeHidden();
    const before = await floating.boundingBox();
    if (!before) throw new Error("floating window has no box");

    const drag = async (direction: string, dx: number, dy: number) => {
      const handle = floating.locator(`[data-resize-handle="${direction}"]`);
      const box = await handle.boundingBox();
      if (!box) throw new Error(`no ${direction} handle`);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 5 });
      await page.mouse.up();
    };

    // Left edge out by 60: wider, right edge fixed.
    await drag("w", -60, 0);
    const wider = await floating.boundingBox();
    expect(wider?.width).toBeCloseTo(before.width + 60, 0);
    expect((wider?.x ?? 0) + (wider?.width ?? 0)).toBeCloseTo(before.x + before.width, 0);

    // Bottom-right corner in by (40, 50): narrower and shorter, top-left fixed.
    await drag("se", -40, -50);
    const smaller = await floating.boundingBox();
    expect(smaller?.width).toBeCloseTo(before.width + 20, 0);
    expect(smaller?.height).toBeCloseTo(before.height - 50, 0);
    expect(smaller?.x).toBeCloseTo(wider?.x ?? 0, 0);
    expect(smaller?.y).toBeCloseTo(before.y, 0);
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
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);

    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Before I create a plan, I have a few questions")).toBeVisible();
    // A required question must be answered first.
    await panel.getByRole("button", { name: "Send answers" }).click();
    await expect(panel.getByRole("alert")).toHaveText("Please answer: Which assembler?");

    await panel.getByRole("button", { name: "SPAdes" }).click();
    await panel.getByRole("textbox", { name: "Your answer to: Anything else?" }).fill("Keep contigs over 500 bp");
    await panel.getByRole("button", { name: "Send answers" }).click();

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
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);

    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Prepared — nothing submitted yet")).toBeVisible();
    await expect(panel.getByText("Genome assembly of SRR123456 (unicycler)")).toBeVisible();
    await expect(panel.getByText("Submit this job?")).toBeVisible();
    await panel.getByRole("button", { name: "Yes, submit it" }).click();

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
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);

    const panel = page.getByRole("dialog");
    await panel.getByRole("button", { name: "No", exact: true }).click();
    await expect(panel.getByText("Not submitted.")).toBeVisible();
    expect(chat.declines).toEqual([{ actions: [preparedJob] }]);
    expect(chat.turns).toEqual([]);

    await expect(panel.getByText("Should anything be changed?")).toBeVisible();
    const change = panel.getByRole("textbox", { name: "Describe the change" });
    await change.fill("use SPAdes instead");
    await change.press("Enter");

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
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);
    const panel = page.getByRole("dialog");

    await expect(panel.getByRole("radio", { name: "Plan" })).toHaveAttribute("aria-checked", "true");
    await panel.getByRole("radio", { name: "Execute" }).click();
    await expect(panel.getByText(/Execute mode: the Copilot may submit jobs/)).toBeVisible();

    const box = panel.getByRole("textbox", { name: "Ask the Copilot" });
    await box.fill(question);
    await box.press("Enter");
    await expect.poll(() => chat.sent.length).toBe(1);
    expect(chat.sent[0]).toEqual(expect.objectContaining({ executionMode: "execute" }));
  });

  test("runs a plan step by step, waiting for the job a step submitted", async ({ page }) => {
    const chat = planChat();
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);

    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("heading", { name: "Assemble and annotate SRR123456" })).toBeVisible();
    await expect(panel.getByText("Draft")).toBeVisible();
    await panel.getByRole("button", { name: "Run plan" }).click();

    // Step 1 runs, submits a job, and the plan waits for it.
    await expect(panel.getByRole("button", { name: "Continue plan" })).toBeVisible();
    await expect(panel.getByText("The job finished.")).toBeVisible();
    await expect(panel.getByText("Step 1 done")).toBeVisible();
    // A step's question is not shown as the user's.
    await expect(panel.getByText("Execute plan step:")).toHaveCount(0);

    await panel.getByRole("button", { name: "Continue plan" }).click();
    await expect(panel.getByText("All steps are done.")).toBeVisible();

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
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);

    const panel = page.getByRole("dialog");
    await panel.getByRole("button", { name: "Edit" }).click();
    await panel.getByRole("textbox", { name: "Step 2: what to do" }).fill("Annotate with RASTtk");
    await panel.getByRole("button", { name: "Move step 2 up" }).click();
    await panel.getByRole("button", { name: "Save changes" }).click();

    await expect(panel.getByRole("button", { name: "Run plan" })).toBeVisible();
    expect(chat.saves).toHaveLength(1);
    expect(chat.saves[0].steps).toEqual([
      expect.objectContaining({ step_id: "step_2", description: "Annotate with RASTtk", depends_on: ["step_1"] }),
      expect.objectContaining({ step_id: "step_1", description: "Assemble the reads" }),
    ]);
  });

  test("sends an attached text file with the question", async ({ page }) => {
    const chat = chatOverrides();
    await applyBackendMocks(page, {
      overrides: [...chat.overrides, ...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await openPanel(page);

    const panel = page.getByRole("dialog");
    await panel.locator('input[type="file"]').setInputFiles({
      name: "ids.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("SRR123456\nSRR654321\n"),
    });
    await expect(panel.getByRole("list", { name: "Attached files" })).toContainText("ids.txt");
    await panel.getByRole("textbox", { name: "Ask the Copilot" }).fill("Assemble these runs");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect.poll(() => chat.sent.length).toBe(1);
    expect(chat.sent[0]).toEqual(
      expect.objectContaining({
        query: "Assemble these runs",
        files: [{ name: "ids.txt", content: "SRR123456\nSRR654321\n", mimeType: "text/plain", size: 20 }],
      }),
    );
    await expect(panel.getByRole("list", { name: "Attached files" })).toHaveCount(0);
  });

  test("full page shows the chat list beside an empty chat", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...copilotOverrides, ...workspacePopulatedOverrides, ...journeyOverrides],
    });
    await page.goto("/copilot");
    await expect(page.getByRole("complementary", { name: "Your chats" })).toBeVisible();
    await expect(page.getByText("No chats yet.")).toBeVisible();
    await expect(page.getByText("Ask the BV-BRC Copilot")).toBeVisible();
    // The navbar button is hidden on the full page.
    await expect(page.getByRole("button", { name: "Open the Copilot" })).toBeHidden();
  });
});
