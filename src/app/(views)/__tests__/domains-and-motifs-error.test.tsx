import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DomainsAndMotifsError from "../domains-and-motifs/error";

describe("DomainsAndMotifsError", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("keeps error details out of the UI, logs the error, and retries", async () => {
    const error = new Error("request failed with token secret-123");
    const reset = vi.fn();
    const retry = vi.fn();

    render(<DomainsAndMotifsError error={error} reset={reset} retry={retry} />);

    expect(screen.queryByText(/secret-123/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("An unexpected error occurred while loading this view."),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(error);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });
});
