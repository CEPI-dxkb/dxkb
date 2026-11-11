import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CopilotPlanActionsProvider,
  PlanCardView,
  type CopilotPlanActions,
} from "../copilot-plan-card";
import type { CopilotPlan, CopilotPlanStep, CopilotPlanStepUpdate } from "@/lib/copilot/plan";

function step(id: string, changes: Partial<CopilotPlanStep> = {}): CopilotPlanStep {
  return {
    stepId: id,
    description: `Do ${id}`,
    agent: "data",
    dependsOn: [],
    status: "pending",
    resultSummary: null,
    errorMessage: null,
    ...changes,
  };
}

function makePlan(steps: CopilotPlanStep[]): CopilotPlan {
  return {
    planId: "p1",
    title: "A plan",
    description: null,
    status: "draft",
    steps,
    waitingFor: [],
    raw: {},
  };
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

function makeActions(changes: Partial<CopilotPlanActions> = {}): CopilotPlanActions {
  return {
    currentPlanId: "p1",
    busy: false,
    liveUpdates: [],
    watches: undefined,
    isPaused: () => false,
    run: vi.fn(),
    continuePlan: vi.fn(),
    pause: vi.fn(),
    retryStep: vi.fn(),
    skipStep: vi.fn(),
    regenerate: vi.fn(),
    saveSteps: vi.fn(() => Promise.resolve(true)),
    ...changes,
  };
}

function ui(plan: CopilotPlan, actions: CopilotPlanActions) {
  return (
    <CopilotPlanActionsProvider value={actions}>
      <PlanCardView messageId="m1" plan={plan} />
    </CopilotPlanActionsProvider>
  );
}

const twoSteps = () => makePlan([step("step_1"), step("step_2")]);

describe("PlanCardView editor", () => {
  it("disables Cancel and hides Run plan while a save is pending", async () => {
    const user = userEvent.setup();
    const actions = makeActions({ saveSteps: vi.fn(() => new Promise<boolean>(() => undefined)) });
    render(ui(twoSteps(), actions));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /run plan/i })).not.toBeInTheDocument();
  });

  it("enables Save again when the save rejects", async () => {
    const user = userEvent.setup();
    const actions = makeActions({ saveSteps: vi.fn(() => Promise.reject(new Error("nope"))) });
    render(ui(twoSteps(), actions));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("saves a step that is not editable with its live status", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const plan = {
      ...makePlan([step("step_1", { status: "skipped" }), step("step_2")]),
      status: "executing",
    };
    const { rerender } = render(ui(plan, actions));
    await user.click(screen.getByRole("button", { name: /edit remaining steps/i }));
    rerender(
      ui(plan, {
        ...actions,
        liveUpdates: [stepUpdate({ stepId: "step_1", status: "completed" })],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(actions.saveSteps).toHaveBeenCalledWith(
      expect.objectContaining({ planId: "p1" }),
      [
        expect.objectContaining({ stepId: "step_1", status: "completed" }),
        expect.objectContaining({ stepId: "step_2", status: "pending" }),
      ],
    );
  });

  it("shows an alert and does not save when an edited step started running", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const plan = twoSteps();
    const { rerender } = render(ui(plan, actions));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    rerender(
      ui(plan, {
        ...actions,
        liveUpdates: [stepUpdate({ stepId: "step_1", status: "running" })],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The plan moved on while you were editing.",
    );
    expect(actions.saveSteps).not.toHaveBeenCalled();
  });

  it("disables Save while a step is running", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const plan = twoSteps();
    const { rerender } = render(ui(plan, actions));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    rerender(ui(plan, { ...actions, busy: true }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText("A step is running. Save when it stops.")).toBeInTheDocument();
  });

  it("does not let a step move above one it depends on", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const dependent = makePlan([step("step_1"), step("step_2", { dependsOn: ["step_1"] })]);
    const { unmount } = render(ui(dependent, actions));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: "Move step 2 up" })).toBeDisabled();
    expect(screen.getByText("Runs after step 1")).toBeInTheDocument();
    unmount();

    render(ui(twoSteps(), actions));
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: "Move step 2 up" })).toBeEnabled();
  });
});
