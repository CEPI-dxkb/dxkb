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

  it("explains the taxonomy failure, logs it, and retries by refetching", async () => {
    const error = Object.assign(new Error("taxonomy unavailable"), { digest: "digest-1" });
    const reset = vi.fn();
    const retry = vi.fn();

    render(<OrganismsError error={error} reset={reset} retry={retry} />);

    expect(
      screen.getByRole("heading", { name: "Organism data is temporarily unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/could not load the taxonomy data/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(error);

    // reset() alone re-renders the same failed server payload; retry() also
    // refreshes the route so the server data is fetched again.
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
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
