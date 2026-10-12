import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";

import { usePickCheck, type PickRejection } from "../use-pick-check";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));

function deferred() {
  let resolve: (rejection: PickRejection | null) => void = () => undefined;
  const promise = new Promise<PickRejection | null>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("usePickCheck", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.dismiss).mockClear();
  });

  it("drops an older pick's result once a newer pick starts", async () => {
    const { result } = renderHook(() => usePickCheck());
    const older = deferred();
    const olderHandlers = { onPass: vi.fn(), onReject: vi.fn() };
    const newerHandlers = { onPass: vi.fn(), onReject: vi.fn() };

    let olderRun: Promise<void> = Promise.resolve();
    act(() => {
      olderRun = result.current.start("/a", {
        check: () => older.promise,
        ...olderHandlers,
      });
    });
    await act(() =>
      result.current.start("/b", {
        check: () => Promise.resolve({ title: "Bad", message: "B is bad" }),
        ...newerHandlers,
      }),
    );
    await act(async () => {
      older.resolve(null);
      await olderRun;
    });

    expect(olderHandlers.onPass).not.toHaveBeenCalled();
    expect(newerHandlers.onReject).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({
      status: "rejected",
      path: "/b",
      rejection: { title: "Bad", message: "B is bad" },
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("drops a running check's result, and its toast, on cancel", async () => {
    const { result } = renderHook(() => usePickCheck());
    const check = deferred();
    const handlers = { onPass: vi.fn(), onReject: vi.fn() };

    let run: Promise<void> = Promise.resolve();
    act(() => {
      run = result.current.start("/a", {
        check: () => check.promise,
        ...handlers,
      });
    });
    expect(result.current.isValidating).toBe(true);
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      check.resolve({ title: "Bad", message: "A is bad" });
      await run;
    });

    expect(result.current.state).toBeNull();
    expect(handlers.onReject).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("drops a running check's result when the page unmounts", async () => {
    const { result, unmount } = renderHook(() => usePickCheck());
    const check = deferred();
    const handlers = { onPass: vi.fn(), onReject: vi.fn() };

    let run: Promise<void> = Promise.resolve();
    act(() => {
      run = result.current.start("/a", {
        check: () => check.promise,
        ...handlers,
      });
    });
    unmount();
    check.resolve({ title: "Bad", message: "A is bad" });
    await run;

    expect(handlers.onReject).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("dismisses a rejection's toast when the page unmounts", async () => {
    const { result, unmount } = renderHook(() => usePickCheck());

    await act(() =>
      result.current.start("/a", {
        check: () => Promise.resolve({ title: "Bad", message: "A is bad" }),
        onPass: vi.fn(),
        onReject: vi.fn(),
      }),
    );
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    vi.mocked(toast.dismiss).mockClear();

    unmount();
    expect(toast.dismiss).toHaveBeenCalledWith(options?.id);
  });

  it("keeps a rejection's toast until it is closed or the pick changes", async () => {
    const { result } = renderHook(() => usePickCheck());
    const rejection = { title: "Invalid FASTA file", message: "Too short" };

    await act(() =>
      result.current.start("/a", {
        check: () => Promise.resolve(rejection),
        onPass: vi.fn(),
        onReject: vi.fn(),
      }),
    );

    expect(result.current.rejection).toEqual(rejection);
    expect(toast.error).toHaveBeenCalledWith("Invalid FASTA file", {
      id: expect.any(String) as unknown,
      description: "Too short",
      closeButton: true,
      duration: Infinity,
    });
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    vi.mocked(toast.dismiss).mockClear();

    act(() => {
      result.current.cancel();
    });
    expect(toast.dismiss).toHaveBeenCalledWith(options?.id);
  });
});
