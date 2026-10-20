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

  it("announces the error as an alert, without the Retry label in it", () => {
    render(
      <MolstarStatusOverlay
        status="error"
        errorMessage="Could not download 6VXX from your workspace (HTTP 504)."
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not download 6VXX from your workspace (HTTP 504).",
    );
    expect(alert).not.toHaveTextContent("Retry");
  });

  it("announces nothing while loading", () => {
    render(
      <MolstarStatusOverlay status="loading" errorMessage={undefined} onRetry={onRetry} />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MolstarStatusOverlay status="error" errorMessage="Failed" onRetry={onRetry} />,
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses the size-10 icon and max-w-sm message width in the error state", () => {
    const { container } = render(
      <MolstarStatusOverlay status="error" errorMessage="Error" onRetry={onRetry} />,
    );

    const icon = container.querySelector("svg");
    expect(icon?.classList.contains("size-10")).toBe(true);

    const message = screen.getByText("Error");
    expect(message.classList.contains("max-w-sm")).toBe(true);
  });
});
