import {
  appendAnswer,
  decodeCopilotEvent,
  isCopilotTurnActive,
  reduceCopilotTurn,
  startCopilotTurn,
  type CopilotEvent,
} from "../turn";

let notes = 0;
const noteId = () => `note-${String((notes += 1))}`;

function decode(event: string, data: unknown) {
  return decodeCopilotEvent(
    { event, data: typeof data === "string" ? data : JSON.stringify(data) },
    noteId,
  );
}

function run(events: CopilotEvent[]) {
  return events.reduce(reduceCopilotTurn, startCopilotTurn("t1", "Find Mpox genomes"));
}

describe("decodeCopilotEvent", () => {
  it("reads a structured progress step", () => {
    expect(
      decode("progress", {
        step_id: "t3",
        phase: "tool",
        status: "done",
        label: "Looking up genomes",
        result: "1,234 genomes found",
        took_ms: 2310,
        agent_label: "Searching BV-BRC data",
      }),
    ).toEqual({
      type: "step",
      step: {
        stepId: "t3",
        phase: "tool",
        status: "done",
        label: "Looking up genomes",
        detail: null,
        result: "1,234 genomes found",
        agentLabel: "Searching BV-BRC data",
        tookMs: 2310,
        transient: false,
      },
    });
  });

  it("turns an older free-text progress update into a transient note", () => {
    expect(decode("progress", { message: "Planning next step..." })).toEqual({
      type: "step",
      step: expect.objectContaining({
        label: "Planning next step...",
        phase: "note",
        transient: true,
      }) as unknown,
    });
  });

  it("reads answer chunks and their card", () => {
    expect(decode("final_response", { chunk: "Hello" })).toEqual({
      type: "answer",
      chunk: "Hello",
      card: null,
    });
    expect(
      decode("final_response", {
        chunk: "",
        card: { card_type: "plan", card_payload: { plan_id: "p1" } },
      }),
    ).toEqual({
      type: "answer",
      chunk: "",
      card: { cardType: "plan", payload: { plan_id: "p1" } },
    });
  });

  it("reads started, error, cancelled and done", () => {
    expect(decode("started", { job_id: "j1" })).toEqual({ type: "started", jobId: "j1" });
    expect(decode("error", { error: "Model unavailable" })).toEqual({
      type: "error",
      message: "Model unavailable",
    });
    expect(decode("cancelled", { job_id: "j1" })).toEqual({ type: "cancelled" });
    expect(decode("done", { job_id: "j1", message_id: "m9" })).toEqual({
      type: "done",
      messageId: "m9",
      cancelled: false,
    });
  });

  it("ignores events the transcript does not show and unreadable data", () => {
    expect(decode("tool_executed", { tool: "x" })).toBeNull();
    expect(decode("plan_step_started", { plan_id: "p" })).toBeNull();
    expect(decode("final_response", "not json")).toBeNull();
  });
});

describe("plan step events", () => {
  it("reads step updates and the jobs a step submitted", () => {
    expect(
      decode("plan_step_failed", { plan_id: "p", step_id: "step_2", step_index: 1, error: "No genomes" }),
    ).toEqual({
      type: "planStep",
      update: {
        planId: "p",
        stepId: "step_2",
        stepIndex: 1,
        status: "failed",
        resultSummary: null,
        errorMessage: "No genomes",
        submissionIds: [],
      },
    });
    expect(
      decode("plan_workflow_submitted", { plan_id: "p", step_index: 0, submission_ids: ["s1", 3, "s2"] }),
    ).toEqual({
      type: "planStep",
      update: expect.objectContaining({ status: null, submissionIds: ["s1", "s2"] }) as unknown,
    });
    expect(decode("plan_step_blocked", { plan_id: "p", step_id: "a" })).toEqual({
      type: "planStep",
      update: expect.objectContaining({ status: "awaiting_approval" }) as unknown,
    });
  });

  it("ignores a plan step update whose only reference is a negative index", () => {
    expect(
      decode("plan_step_completed", { plan_id: "p", step_index: -1 }),
    ).toBeNull();
  });

  it("keeps a turn's step updates in order", () => {
    const events = [
      decode("plan_step_started", { plan_id: "p", step_index: 0 }),
      decode("plan_step_completed", { plan_id: "p", step_index: 0, result_summary: "Done" }),
    ].filter((event): event is CopilotEvent => event !== null);
    expect(run(events).planUpdates.map((item) => item.status)).toEqual([
      "running",
      "completed",
    ]);
  });
});

describe("appendAnswer", () => {
  it("skips only a chunk that repeats the whole answer", () => {
    expect(appendAnswer("Hello world", "Hello world")).toBe("Hello world");
    expect(appendAnswer("Hello", " world")).toBe("Hello world");
    expect(appendAnswer("**bold**", "**")).toBe("**bold****");
    expect(appendAnswer("Hello world", "world")).toBe("Hello worldworld");
    expect(appendAnswer("a", "a")).toBe("aa");
  });
});

describe("reduceCopilotTurn", () => {
  it("follows a turn from queued to done", () => {
    const turn = run([
      { type: "queued", message: "High usage" },
      { type: "started", jobId: "j1" },
      {
        type: "step",
        step: {
          stepId: "s1",
          phase: "tool",
          status: "running",
          label: "Searching",
          detail: null,
          result: null,
          agentLabel: null,
          tookMs: null,
          transient: false,
        },
      },
      {
        type: "step",
        step: {
          stepId: "s1",
          phase: "tool",
          status: "done",
          label: "Searched",
          detail: null,
          result: "12 found",
          agentLabel: null,
          tookMs: 900,
          transient: false,
        },
      },
      { type: "answer", chunk: "Found ", card: null },
      { type: "answer", chunk: "12.", card: null },
      { type: "done", messageId: "m1", cancelled: false },
    ]);
    expect(turn).toEqual(
      expect.objectContaining({
        status: "done",
        jobId: "j1",
        queuedMessage: null,
        answer: "Found 12.",
        messageId: "m1",
        steps: [expect.objectContaining({ stepId: "s1", status: "done", result: "12 found" })],
      }),
    );
    expect(isCopilotTurnActive(turn)).toBe(false);
  });

  it("shows a transient note on the live line without listing it", () => {
    const turn = run([
      {
        type: "step",
        step: {
          stepId: "note-1",
          phase: "note",
          status: "running",
          label: "Retrying",
          detail: null,
          result: null,
          agentLabel: null,
          tookMs: null,
          transient: true,
        },
      },
    ]);
    expect(turn.liveLabel).toBe("Retrying");
    expect(turn.steps).toEqual([]);
  });

  it("keeps a turn's end: nothing after Stop or an error changes it", () => {
    const stopped = run([
      { type: "answer", chunk: "Partial", card: null },
      { type: "cancelled" },
      { type: "answer", chunk: " more", card: null },
    ]);
    expect(stopped).toEqual(expect.objectContaining({ status: "stopped", answer: "Partial" }));

    const failed = run([{ type: "error", message: "Boom" }, { type: "done", messageId: null, cancelled: false }]);
    expect(failed).toEqual(expect.objectContaining({ status: "error", error: "Boom" }));
  });

  it("uses a card event's message as the answer when nothing was written", () => {
    const turn = run([
      {
        type: "card",
        card: { cardType: "clarification", payload: {} },
        message: "A few questions first",
      },
    ]);
    expect(turn.answer).toBe("A few questions first");
    expect(turn.card).toEqual({ cardType: "clarification", payload: {} });
  });
});
