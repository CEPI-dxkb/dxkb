import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../forget-failed-counts", () => ({
  forgetFailedCounts: vi.fn(() => Promise.resolve()),
}));

import { CountRetryScope } from "../count-retry-scope";
import { forgetFailedCounts } from "../forget-failed-counts";
import { UnavailableCount } from "../unavailable-count";
import { createPendingNavigation } from "@/test-helpers/pending-navigation";

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(forgetFailedCounts).mockReset();
  vi.mocked(forgetFailedCounts).mockResolvedValue(undefined);
});

describe("UnavailableCount", () => {
  it("is a red button named Unavailable whose reason is reachable but not shown", () => {
    render(
      <CountRetryScope taxonIds={[2]}>
        <UnavailableCount reason="PDB structures: join timed out." />
      </CountRetryScope>,
    );

    const button = screen.getByRole("button", { name: /^Unavailable$/ });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("text-destructive");
    // No native title: it would draw over the value beside the tile's own
    // description tooltip.
    expect(button).not.toHaveAttribute("title");
    expect(button).toHaveAccessibleDescription(
      "Click to retry. PDB structures: join timed out.",
    );
    // The reason has no visible text element: only the hidden described-by
    // target (and the tile's description) carries it.
    expect(
      screen.getByText("Click to retry. PDB structures: join timed out."),
    ).not.toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(button).not.toHaveAttribute("aria-disabled");
    // A pointer cursor at rest; the not-allowed cursor while retrying comes
    // from its own `aria-disabled:` variant (no native `disabled`, so the
    // base-layer `:disabled` rule never applies), which Tailwind emits after
    // the plain utility, so it wins whatever the class order.
    expect(button).toHaveClass("cursor-pointer", "aria-disabled:cursor-not-allowed");
    expect(button.className).not.toMatch(/pointer-events-none/);
  });

  it("forgets the scope's failed counts, then refreshes the route once, and is clickable again after", async () => {
    const calls: string[] = [];
    vi.mocked(forgetFailedCounts).mockImplementation((taxonIds) => {
      calls.push(`forget ${JSON.stringify(taxonIds)}`);
      return Promise.resolve();
    });
    refresh.mockImplementation(() => {
      calls.push("refresh");
    });
    render(
      <CountRetryScope taxonIds={[131567, 10239]}>
        <UnavailableCount reason="count down" />
      </CountRetryScope>,
    );

    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Unavailable/ }));
      return Promise.resolve();
    });

    await waitFor(() => {
      expect(calls).toEqual(["forget [131567,10239]", "refresh"]);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Unavailable$/ }),
      ).not.toHaveAttribute("aria-disabled");
    });
  });

  it("still refreshes, and logs why, when forgetting the failures fails", async () => {
    const error = new Error("action unreachable");
    vi.mocked(forgetFailedCounts).mockRejectedValueOnce(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(
      <CountRetryScope taxonIds={[2]}>
        <UnavailableCount reason="count down" />
      </CountRetryScope>,
    );

    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Unavailable/ }));
      return Promise.resolve();
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("failed counts"),
      error,
    );
    consoleError.mockRestore();
  });

  it("disables and spins every Unavailable in the scope while the retry is pending, named Unavailable alone", async () => {
    const navigation = createPendingNavigation();
    refresh.mockImplementation(() => {
      navigation.arm();
    });
    render(
      <Suspense fallback={null}>
        <CountRetryScope taxonIds={[2]}>
          <UnavailableCount reason="summary down" />
          <UnavailableCount reason="count down" />
        </CountRetryScope>
        <navigation.Suspender />
      </Suspense>,
    );

    const [first] = screen.getAllByRole("button", { name: /^Unavailable/ });
    await act(() => {
      fireEvent.click(first);
      return Promise.resolve();
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    // The spinner is decorative: the name stays "Unavailable" and the busy
    // state is aria-busy, not a nested status.
    const buttons = screen.getAllByRole("button", { name: /^Unavailable$/ });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      // aria-disabled, not native disabled, so a focused button keeps focus.
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.queryByRole("status")).toBeNull();

    await act(() => {
      fireEvent.click(buttons[1]);
      return Promise.resolve();
    });
    expect(forgetFailedCounts).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps keyboard focus on the button while it retries", async () => {
    const navigation = createPendingNavigation();
    refresh.mockImplementation(() => {
      navigation.arm();
    });
    render(
      <Suspense fallback={null}>
        <CountRetryScope taxonIds={[2]}>
          <UnavailableCount reason="count down" />
        </CountRetryScope>
        <navigation.Suspender />
      </Suspense>,
    );

    const button = screen.getByRole("button", { name: /^Unavailable$/ });
    button.focus();
    expect(button).toHaveFocus();
    await act(() => {
      fireEvent.click(button);
      return Promise.resolve();
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(button);
  });

  it("refuses to render outside a CountRetryScope", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => render(<UnavailableCount reason="count down" />)).toThrow(
      /CountRetryScope/,
    );

    consoleError.mockRestore();
  });
});
