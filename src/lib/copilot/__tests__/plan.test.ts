import {
  applyPlanUpdates,
  copilotPlanObject,
  copilotPlanState,
  mergeEditedSteps,
  mustRunAfter,
  newPlanStepId,
  planStepQuery,
  readCopilotPlan,
  withStepStatus,
  type CopilotPlan,
  type CopilotPlanStepUpdate,
} from "../plan";

const stored = {
  plan_id: "p1",
  title: "Find and annotate",
  description: "Two steps",
  status: "draft",
  current_step_index: 0,
  steps: [
    {
      step_id: "step_1",
      description: "Find genomes",
      agent: "data",
      reasoning: "first",
      depends_on: [],
      status: "pending",
      step_outputs: { genome_ids: ["1.1"] },
    },
    {
      step_id: "step_2",
      description: "Annotate them",
      agent: "service",
      reasoning: "second",
      depends_on: ["step_1"],
      status: "pending",
    },
  ],
};

function plan(changes: Partial<CopilotPlan> = {}): CopilotPlan {
  const read = readCopilotPlan(stored);
  if (!read) throw new Error("unreadable");
  return { ...read, ...changes };
}

function update(changes: Partial<CopilotPlanStepUpdate>): CopilotPlanStepUpdate {
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

describe("readCopilotPlan", () => {
  it("reads the planning agent's plan", () => {
    expect(plan()).toEqual(
      expect.objectContaining({
        planId: "p1",
        title: "Find and annotate",
        status: "draft",
        waitingFor: [],
        steps: [
          expect.objectContaining({ stepId: "step_1", agent: "data", status: "pending" }),
          expect.objectContaining({ stepId: "step_2", dependsOn: ["step_1"] }),
        ],
      }),
    );
  });

  it("refuses a plan without an id or steps, and drops unreadable steps", () => {
    expect(readCopilotPlan({ steps: [] })).toBeNull();
    expect(readCopilotPlan({ plan_id: "p", steps: [{ description: "no id" }] })).toBeNull();
    expect(
      readCopilotPlan({
        plan_id: "p",
        steps: [{ step_id: "a", status: "weird" }, "x"],
        _waitingForWorkflows: { s1: { status: "active" }, s2: { status: "completed" } },
      }),
    ).toEqual(
      expect.objectContaining({
        title: "Plan",
        steps: [expect.objectContaining({ stepId: "a", status: "pending", agent: "direct" })],
        waitingFor: ["s1"],
      }),
    );
  });
});

describe("applyPlanUpdates", () => {
  it("applies a turn's step events, and the jobs a step submitted", () => {
    const next = applyPlanUpdates(plan({ status: "executing" }), [
      update({ stepId: "step_1", status: "running" }),
      update({ stepIndex: 0, status: "completed", resultSummary: "Found 3" }),
      update({ stepIndex: 1, submissionIds: ["sub1"] }),
      update({ planId: "other", stepIndex: 1, status: "failed" }),
    ]);
    expect(next.steps.map((step) => step.status)).toEqual(["completed", "pending"]);
    expect(next.steps[0].resultSummary).toBe("Found 3");
    expect(next.waitingFor).toEqual(["sub1"]);
  });

  it("does not set a completed step back to running", () => {
    const done = withStepStatus(plan(), 0, "completed");
    const next = applyPlanUpdates(done, [update({ stepIndex: 0, status: "running" })]);
    expect(next.steps[0].status).toBe("completed");
  });

  it("ignores a negative step index", () => {
    const original = plan();
    expect(
      applyPlanUpdates(original, [update({ stepIndex: -2, status: "failed" })]),
    ).toBe(original);
  });

  it("returns the same plan when nothing applies", () => {
    const original = plan();
    expect(applyPlanUpdates(original, [])).toBe(original);
  });
});

describe("copilotPlanState", () => {
  const executing = plan({ status: "executing" });

  it("follows a plan from draft to completed", () => {
    expect(copilotPlanState(plan())).toEqual({ kind: "draft" });
    expect(copilotPlanState(executing)).toEqual({ kind: "ready", stepIndex: 0 });
    const first = withStepStatus(executing, 0, "completed");
    expect(copilotPlanState(first)).toEqual({ kind: "ready", stepIndex: 1 });
    expect(copilotPlanState(withStepStatus(first, 1, "skipped"))).toEqual({
      kind: "completed",
    });
  });

  it("stops for the user, a failure, an interruption, or jobs", () => {
    expect(copilotPlanState(withStepStatus(executing, 1, "needs_input"))).toEqual({
      kind: "waitingForUser",
      stepIndex: 1,
    });
    expect(copilotPlanState(withStepStatus(executing, 0, "awaiting_approval"))).toEqual({
      kind: "waitingForUser",
      stepIndex: 0,
    });
    expect(copilotPlanState(withStepStatus(executing, 0, "failed"))).toEqual({
      kind: "failed",
      stepIndex: 0,
    });
    expect(copilotPlanState(withStepStatus(executing, 0, "running"))).toEqual({
      kind: "interrupted",
      stepIndex: 0,
    });
    expect(copilotPlanState({ ...executing, waitingFor: ["s1"] })).toEqual({
      kind: "waitingForJobs",
      submissionIds: ["s1"],
    });
  });
});

describe("copilotPlanObject", () => {
  it("writes status, steps and waits into the stored plan, keeping its other fields", () => {
    const original = plan();
    const object = copilotPlanObject(original, {
      status: "executing",
      steps: [
        { ...original.steps[1], description: "Annotate all" },
        {
          stepId: newPlanStepId(original),
          description: "Build a tree",
          agent: "service",
          dependsOn: ["step_2"],
          status: "pending",
          resultSummary: null,
          errorMessage: null,
        },
      ],
      waitingFor: ["s1"],
    });
    expect(object).toEqual(
      expect.objectContaining({
        plan_id: "p1",
        current_step_index: 0,
        status: "executing",
        _waitingForWorkflows: { s1: { status: "active" } },
      }),
    );
    expect(object.steps).toEqual([
      expect.objectContaining({
        step_id: "step_2",
        description: "Annotate all",
        reasoning: "second",
        // step_1 was deleted: nothing waits for it.
        depends_on: [],
      }),
      expect.objectContaining({
        step_id: "step_3",
        reasoning: "Added by the user.",
        depends_on: ["step_2"],
      }),
    ]);
  });

  it("drops the wait once it is cleared", () => {
    const waiting = readCopilotPlan(copilotPlanObject(plan(), { waitingFor: ["s1"] }));
    if (!waiting) throw new Error("unreadable");
    // As sent: JSON drops `undefined` keys; `structuredClone` would keep them.
    const cleared = JSON.parse(
      JSON.stringify(copilotPlanObject(waiting, { waitingFor: [] })),
    ) as Record<string, unknown>;
    expect(cleared).not.toHaveProperty("_waitingForWorkflows");
  });

  it("names a step's hidden question as BV-BRC does", () => {
    expect(planStepQuery(plan(), 1)).toBe("Execute plan step: Annotate them");
  });

  it("does not count a negative index from the end", () => {
    expect(planStepQuery(plan(), -1)).not.toContain("Annotate them");
    expect(planStepQuery(plan(), -1)).toBe("Execute plan step: step 0");
  });
});

describe("mustRunAfter", () => {
  it("is true only when the step depends on the other", () => {
    const { steps } = plan();
    expect(mustRunAfter(steps[1], steps[0])).toBe(true);
    expect(mustRunAfter(steps[0], steps[1])).toBe(false);
  });
});

describe("mergeEditedSteps", () => {
  it("takes the live status of steps that are not pending", () => {
    const edited = plan().steps.map((step) => ({ ...step, description: `${step.description}!` }));
    const live = plan({ status: "executing" });
    live.steps = withStepStatus(live, 0, "completed").steps;
    const merged = mergeEditedSteps(live, [edited[1], { ...edited[0], status: "completed" }]);
    expect(merged?.map((step) => step.stepId)).toEqual(["step_2", "step_1"]);
    expect(merged?.[1]).toBe(live.steps[0]);
    expect(merged?.[0].description).toBe("Annotate them!");
  });

  it("returns null when an edited pending step is no longer pending", () => {
    const edited = plan().steps;
    expect(mergeEditedSteps(withStepStatus(plan(), 0, "running"), edited)).toBeNull();
    expect(mergeEditedSteps(withStepStatus(plan(), 0, "completed"), edited)).toBeNull();
  });

  it("returns null when a live step that ran is missing from the edit", () => {
    const live = withStepStatus(plan(), 0, "completed");
    expect(mergeEditedSteps(live, [live.steps[1]])).toBeNull();
  });
});
