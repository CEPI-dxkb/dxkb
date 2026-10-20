import { Suspense, use, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RefreshRetryButton, RetryButton } from "../retry-button";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

function Refetched({ request }: { request: Promise<string> }) {
  return <p>{use(request)}</p>;
}

// Stands in for Next's retry: the update it starts suspends until the
// refetched payload arrives, as router.refresh() does.
function RefetchingPage({ request }: { request: Promise<string> }) {
  const [refetch, setRefetch] = useState<Promise<string> | null>(null);
  return (
    <Suspense fallback={<p>fallback</p>}>
      {refetch && <Refetched request={refetch} />}
      <RetryButton
        retry={() => {
          setRefetch(request);
        }}
      />
    </Suspense>
  );
}

describe("RetryButton", () => {
  it("stays pending, on the old page, while the refetch is in flight", async () => {
    // Never settles: the refetch is still in flight for the whole test.
    const request = new Promise<string>(() => undefined);
    render(<RefetchingPage request={request} />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // The old page stays up (no fallback) and the button says it is working,
    // where a bare retry() gave no feedback at all.
    const pending = screen.getByRole("button", { name: "Retrying…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("calls retry once per click and is ready again when retry settles at once", async () => {
    const retry = vi.fn();
    render(<RetryButton retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });
});

describe("RefreshRetryButton", () => {
  it("re-runs the route's server components", async () => {
    refresh.mockClear();
    render(<RefreshRetryButton />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalledOnce();
  });
});
