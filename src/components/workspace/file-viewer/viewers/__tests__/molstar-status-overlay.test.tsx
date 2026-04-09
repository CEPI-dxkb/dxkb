import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MolstarStatusOverlay } from "../molstar-status-overlay";

describe("MolstarStatusOverlay", () => {
  const onRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when status is ready", () => {
    const { container } = render(
      <MolstarStatusOverlay status="ready" errorMessage={undefined} onRetry={onRetry} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows loading text when status is loading", () => {
    render(
      <MolstarStatusOverlay status="loading" errorMessage={undefined} onRetry={onRetry} />,
    );

    expect(screen.getByText("Loading viewer\u2026")).toBeInTheDocument();
  });

  it("shows initializing text when status is initializing", () => {
    render(
      <MolstarStatusOverlay status="initializing" errorMessage={undefined} onRetry={onRetry} />,
    );

    expect(screen.getByText("Initializing structure\u2026")).toBeInTheDocument();
  });

  it("shows error message and retry button when status is error", () => {
    render(
      <MolstarStatusOverlay status="error" errorMessage="WebGL not supported" onRetry={onRetry} />,
    );

    expect(screen.getByText("WebGL not supported")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MolstarStatusOverlay status="error" errorMessage="Failed" onRetry={onRetry} />,
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses smaller icon and narrower text when compact is true", () => {
    const { container } = render(
      <MolstarStatusOverlay status="error" errorMessage="Error" onRetry={onRetry} compact />,
    );

    const icon = container.querySelector("svg");
    expect(icon?.classList.contains("h-8")).toBe(true);

    const message = screen.getByText("Error");
    expect(message.classList.contains("max-w-xs")).toBe(true);
  });

  it("uses larger icon and wider text when compact is false", () => {
    const { container } = render(
      <MolstarStatusOverlay status="error" errorMessage="Error" onRetry={onRetry} />,
    );

    const icon = container.querySelector("svg");
    expect(icon?.classList.contains("h-10")).toBe(true);

    const message = screen.getByText("Error");
    expect(message.classList.contains("max-w-sm")).toBe(true);
  });
});
