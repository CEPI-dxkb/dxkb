import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenomeBrowserErrorBoundary } from "../genome-browser-error-boundary";

const engine = vi.hoisted(() => ({ failing: true }));

// Fails on every render until the cause is gone: React 19 re-renders an errored
// root once more before handing the error to the boundary.
function FailsUntilFixed({
  message = 'could not find a region with refName "ctgX"',
}: {
  message?: string;
}) {
  if (engine.failing) {
    throw new Error(message);
  }
  return <p>Browser ready</p>;
}

describe("GenomeBrowserErrorBoundary", () => {
  beforeEach(() => {
    engine.failing = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("shows JBrowse's own message and rebuilds on Retry", async () => {
    render(
      <GenomeBrowserErrorBoundary>
        <FailsUntilFixed />
      </GenomeBrowserErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      'could not find a region with refName "ctgX"',
    );
    engine.failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Browser ready")).toBeInTheDocument();
  });

  it("shows the fallback copy for a minified React error", () => {
    render(
      <GenomeBrowserErrorBoundary>
        <FailsUntilFixed message="Minified React error #185; visit https://react.dev/errors/185 for the full message." />
      </GenomeBrowserErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The Genome Browser failed to start.");
    expect(alert).not.toHaveTextContent("Minified React error");
  });

  it("shows the fallback when a child throws undefined", () => {
    const thrown: unknown = undefined;
    function ThrowsUndefined(): never {
      throw thrown;
    }
    render(
      <GenomeBrowserErrorBoundary>
        <ThrowsUndefined />
      </GenomeBrowserErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The Genome Browser failed to start.",
    );
  });
});
