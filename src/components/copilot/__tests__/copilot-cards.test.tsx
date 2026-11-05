import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ClarificationCardView,
  CopilotCardActionsProvider,
  ExecutionCardView,
  type CopilotCardActions,
} from "../copilot-cards";
import type {
  CopilotClarificationCard,
  CopilotExecutionCard,
} from "@/lib/copilot/cards";

function makeActions(changes: Partial<CopilotCardActions> = {}): CopilotCardActions {
  return {
    answerQuestions: vi.fn(() => Promise.resolve(true)),
    runActions: vi.fn(() => Promise.resolve(true)),
    declineActions: vi.fn(() => Promise.resolve(true)),
    reviseActions: vi.fn(() => Promise.resolve(true)),
    ...changes,
  };
}

function clarification(required: boolean, count = 2): CopilotClarificationCard {
  return {
    agent: "data",
    planStep: null,
    questions: Array.from({ length: count }, (_, index) => ({
      id: `q${String(index)}`,
      question: `Question ${String(index)}`,
      options: [],
      required,
    })),
  };
}

const executionCard: CopilotExecutionCard = {
  agent: "service",
  actions: [{ tool: "submit_job", summary: "Run an assembly" }],
  answered: null,
  planId: null,
};

describe("ClarificationCardView", () => {
  it("asks for one answer when nothing is required and nothing was entered", async () => {
    const user = userEvent.setup();
    render(
      <CopilotCardActionsProvider value={makeActions()}>
        <ClarificationCardView messageId="m1" card={clarification(false)} interactive />
      </CopilotCardActionsProvider>,
    );
    await user.click(screen.getByRole("button", { name: /send answers/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Answer at least one question.");
    for (const input of screen.getAllByRole("textbox")) {
      expect(input).not.toHaveAttribute("aria-invalid");
    }
  });

  it("names the highlighted questions when required ones are empty", async () => {
    const user = userEvent.setup();
    render(
      <CopilotCardActionsProvider value={makeActions()}>
        <ClarificationCardView messageId="m1" card={clarification(true)} interactive />
      </CopilotCardActionsProvider>,
    );
    await user.click(screen.getByRole("button", { name: /send answers/i }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/highlighted questions/);
    expect(alert).not.toHaveTextContent(/required/);
  });
});

describe("ExecutionCardView change text", () => {
  it("keeps the typed change when the revision is refused", async () => {
    const user = userEvent.setup();
    const actions = makeActions({ reviseActions: vi.fn(() => Promise.resolve(false)) });
    render(
      <CopilotCardActionsProvider value={actions}>
        <ExecutionCardView messageId="m1" card={executionCard} interactive />
      </CopilotCardActionsProvider>,
    );
    await user.type(screen.getByRole("textbox", { name: /describe a change/i }), "drop it");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(actions.reviseActions).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole("textbox", { name: /describe a change/i })).toHaveValue(
      "drop it",
    );
  });
});
