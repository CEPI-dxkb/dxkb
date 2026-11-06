import { render, screen } from "@testing-library/react";
import { CopilotMarkdown } from "../copilot-markdown";

function fence(lines: number): string {
  const body = Array.from({ length: lines }, (_, index) => `line ${String(index + 1)}`);
  return ["```", ...body, "```"].join("\n");
}

describe("CopilotMarkdown code blocks", () => {
  it("does not collapse an 8-line fence", () => {
    render(<CopilotMarkdown content={fence(8)} />);
    expect(screen.queryByRole("button", { name: /show all/i })).not.toBeInTheDocument();
  });

  it("collapses a 9-line fence", () => {
    render(<CopilotMarkdown content={fence(9)} />);
    expect(screen.getByRole("button", { name: "Show all 9 lines" })).toBeInTheDocument();
  });
});
