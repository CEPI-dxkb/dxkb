import {
  asTargetAgent,
  clarificationQuery,
  executeRunMessage,
  executionQuestion,
  executionYesLabel,
  readClarificationCard,
  readExecutionCard,
} from "../cards";

const job = { tool: "submit_gowe_job", summary: "Assemble reads", arguments: { app: "GenomeAssembly2" } };
const group = { tool: "create_group", summary: "Group of 12 genomes" };
const edit = { tool: "edit_group", summary: "Add 3 genomes" };

describe("readClarificationCard", () => {
  it("reads questions, keeping only string options, and the asking agent", () => {
    expect(
      readClarificationCard({
        agent: "data",
        questions: [
          { id: "host", question: "Which host?", options: ["Human", 3, "", "Swine"], required: true },
          { question: "Any date range?" },
          { question: "" },
          "junk",
        ],
      }),
    ).toEqual({
      agent: "data",
      questions: [
        { id: "host", question: "Which host?", options: ["Human", "Swine"], required: true },
        { id: "q1", question: "Any date range?", options: [], required: false },
      ],
      planStep: null,
    });
  });

  it("reads the plan step that asked", () => {
    expect(
      readClarificationCard({
        agent: "data",
        questions: [{ question: "Q?" }],
        plan_step: { plan_id: "p1", step_id: "step_2", step_index: 1 },
      })?.planStep,
    ).toEqual({ planId: "p1", stepId: "step_2", stepIndex: 1 });
  });

  it("defaults the agent to planning and refuses a card without questions", () => {
    expect(readClarificationCard({ questions: [{ question: "Q?" }] })?.agent).toBe("planning");
    expect(readClarificationCard({ agent: "Bad Agent!", questions: [{ question: "Q?" }] })?.agent).toBe("planning");
    expect(readClarificationCard({ questions: [] })).toBeNull();
    expect(readClarificationCard(null)).toBeNull();
  });
});

describe("readExecutionCard", () => {
  it("reads the prepared actions, agent, and answer", () => {
    expect(
      readExecutionCard({
        agent: "service",
        blocked_actions: [job, { summary: "no tool" }],
        answered: { answer: "other", text: "drop it", at: "2026-10-30" },
      }),
    ).toEqual({
      agent: "service",
      actions: [job],
      answered: { answer: "other", text: "drop it" },
      planId: null,
    });
    expect(
      readExecutionCard({ blocked_actions: [job], plan_context: { plan_id: "p1", step_index: 0 } })
        ?.planId,
    ).toBe("p1");
    expect(readExecutionCard({ blocked_actions: [job], answered: { answer: "maybe" } })?.answered).toBeNull();
    expect(readExecutionCard({ blocked_actions: [] })).toBeNull();
  });
});

describe("execution wording", () => {
  it.each([
    [[job], "Submit this job?", "Yes, submit it"],
    [[job, job, job], "Submit these 3 jobs?", "Yes, submit all 3"],
    [[group], "Create this group?", "Yes, create it"],
    [[edit, edit], "Update these 2 groups?", "Yes, update them"],
    [[group, edit], "Run these 2 group actions?", "Yes, run them"],
    [[job, group], "Run these 2 actions?", "Yes, run them"],
  ])("asks about %j", (actions, question, yes) => {
    expect(executionQuestion(actions)).toBe(question);
    expect(executionYesLabel(actions)).toBe(yes);
  });

  it("words the replay message by what it runs", () => {
    expect(executeRunMessage([job])).toContain("Submit the job exactly as you prepared it");
    expect(executeRunMessage([group])).toContain("Create the group exactly as you prepared it");
    expect(executeRunMessage([job, group])).toContain("Submit the job and create the group");
    const prefix = "Execute mode is on for this message.";
    expect(executeRunMessage([edit])).toBe(
      `${prefix} Update the group exactly as you prepared it above.`,
    );
    const mixed = `${prefix} Run these actions exactly as you prepared them above.`;
    expect(executeRunMessage([job, edit])).toBe(mixed);
    expect(executeRunMessage([group, edit])).toBe(mixed);
  });

  it("reads a negative step index as null", () => {
    expect(
      readClarificationCard({
        agent: "data",
        questions: [{ question: "Q?" }],
        plan_step: { plan_id: "p1", step_id: "step_2", step_index: -1 },
      })?.planStep,
    ).toEqual({ planId: "p1", stepId: "step_2", stepIndex: null });
  });
});

describe("clarificationQuery", () => {
  const answers = [{ question: "Which host?", answer: "Human" }];

  it("sends the planning agent its original request", () => {
    expect(clarificationQuery("planning", "Find genomes", answers)).toBe("Find genomes");
    expect(clarificationQuery("planning", "", answers)).toBe("Submitted clarification responses.");
  });

  it("sends any other agent the request plus the answers", () => {
    expect(clarificationQuery("data", "Find genomes", answers)).toBe(
      "Find genomes\n\nMy answers to your questions:\n- Which host? Human",
    );
  });
});

describe("asTargetAgent", () => {
  it("accepts only plain agent names", () => {
    expect(asTargetAgent("service")).toBe("service");
    expect(asTargetAgent("Service")).toBeNull();
    expect(asTargetAgent("a b")).toBeNull();
    expect(asTargetAgent(5)).toBeNull();
  });
});
