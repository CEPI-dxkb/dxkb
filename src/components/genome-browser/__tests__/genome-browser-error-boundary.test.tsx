import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenomeBrowserErrorBoundary } from "../genome-browser-error-boundary";

const engine = vi.hoisted(() => ({ failing: true }));

// Fails on every render until the test says the cause is gone: React 19
// re-renders a root that errored once more before it hands the error to the
// boundary, so a component that fails only on its first call would never
// reach it.
function FailsUntilFixed() {
  if (engine.failing) {
    throw new Error('could not find a region with refName "ctgX"');
  }
  return <p>Browser ready</p>;
}

describe("GenomeBrowserErrorBoundary", () => {
  beforeEach(() => {
    engine.failing = true;
    // React logs the caught error; keep the test output readable.
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
});
