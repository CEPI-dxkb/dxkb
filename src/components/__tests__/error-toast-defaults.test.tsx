import { act, render, screen } from "@testing-library/react";
import { Toaster, toast } from "sonner";

import {
  ErrorToastDefaults,
  errorToastDurationMs,
} from "@/components/error-toast-defaults";

// Sonner removes a toast this long after its timer ends (exit animation).
const exitAnimationMs = 500;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ErrorToastDefaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(
      <>
        <Toaster duration={3000} />
        <ErrorToastDefaults />
      </>,
    );
  });

  afterEach(async () => {
    toast.dismiss();
    await advance(exitAnimationMs);
    vi.useRealTimers();
  });

  it("keeps error toasts up past the 3 s default, while success toasts still close at 3 s", async () => {
    act(() => {
      toast.success("Saved");
      toast.error("Upload failed: workspace service unreachable");
    });
    await advance(3000 + exitAnimationMs);

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(
      screen.getByText("Upload failed: workspace service unreachable"),
    ).toBeInTheDocument();

    await advance(errorToastDurationMs);
    expect(
      screen.queryByText("Upload failed: workspace service unreachable"),
    ).not.toBeInTheDocument();
  });

  it("gives error toasts a close button", async () => {
    act(() => {
      toast.error("Could not create folder");
    });
    await advance(100);

    expect(screen.getByRole("button", { name: "Close toast" })).toBeInTheDocument();
  });

  it("leaves an error toast's own duration alone", async () => {
    act(() => {
      toast.error("Quick error", { duration: 1000 });
    });
    await advance(1000 + exitAnimationMs);

    expect(screen.queryByText("Quick error")).not.toBeInTheDocument();
  });
});
