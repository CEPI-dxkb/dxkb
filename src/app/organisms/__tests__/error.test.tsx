import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import OrganismsError from "../error";

describe("OrganismsError", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("announces the failure with its digest, logs it, and retries by refetching", async () => {
    const error = Object.assign(new Error("taxonomy unavailable"), { digest: "digest-1" });
    const reset = vi.fn();
    const retry = vi.fn();

    render(<OrganismsError error={error} reset={reset} retry={retry} />);

    const alert = screen.getByRole("alert");
    expect(
      screen.getByRole("heading", { name: "Organism data is temporarily unavailable" }),
    ).toBeInTheDocument();
    // A server error's message is redacted in production, so the digest is
    // the reference and the copy is fixed.
    expect(alert).toHaveTextContent(/could not load the organism data/i);
    expect(alert).toHaveTextContent("Reference: digest-1");
    expect(alert).not.toHaveTextContent("taxonomy unavailable");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(error);

    // reset() alone re-renders the same failed server payload; retry() also
    // refreshes the route so the server data is fetched again.
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("logs only when the error object changes", () => {
    const first = new Error("first");
    const second = new Error("second");
    const { rerender } = render(<OrganismsError error={first} reset={vi.fn()} retry={vi.fn()} />);

    rerender(<OrganismsError error={first} reset={vi.fn()} retry={vi.fn()} />);
    expect(consoleError).toHaveBeenCalledTimes(1);

    rerender(<OrganismsError error={second} reset={vi.fn()} retry={vi.fn()} />);
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenLastCalledWith(second);
  });
});
