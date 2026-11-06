import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopilotSteps } from "../copilot-progress";
import type { CopilotStep } from "@/lib/copilot/types";

const failed: CopilotStep = {
  stepId: "s1",
  phase: "tool",
  status: "error",
  label: "Search genomes",
  detail: null,
  result: null,
  agentLabel: null,
  tookMs: null,
  transient: false,
};

describe("CopilotSteps", () => {
  it("exposes a failed step's status to assistive technology", async () => {
    const user = userEvent.setup();
    render(<CopilotSteps steps={[failed]} />);
    await user.click(screen.getByRole("button", { name: /what i did/i }));
    expect(screen.getByText("Failed:")).toBeInTheDocument();
    expect(screen.getByText("Search genomes")).toBeInTheDocument();
  });
});
