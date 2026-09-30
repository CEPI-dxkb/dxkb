import { act, renderHook } from "@testing-library/react";
import { keywordDebounceMs } from "@/components/filterbar/keyword-search";
import { useDebouncedDraft } from "../use-debounced-draft";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedDraft", () => {
  it("shows typing at once and commits only after the debounce", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("", commit));

    act(() => {
      result.current[1]("eco");
    });
    expect(result.current[0]).toBe("eco");

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs - 1);
    });
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(commit).toHaveBeenCalledExactlyOnceWith("eco");
  });

  it("commits once, with the last value, for several quick edits", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("", commit));

    for (const value of ["e", "ec", "eco", "ecol", "ecoli"]) {
      act(() => {
        result.current[1](value);
      });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs - 100);
      });
    }
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs);
    });
    expect(commit).toHaveBeenCalledExactlyOnceWith("ecoli");
  });

  it("does not commit on mount", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useDebouncedDraft("ecoli", commit));

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs * 3);
    });
    expect(result.current[0]).toBe("ecoli");
    expect(commit).not.toHaveBeenCalled();
  });

  it("takes a committed value from outside as the draft, without committing", () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedDraft(committed, commit),
      { initialProps: { committed: "" } },
    );

    act(() => {
      result.current[1]("typed");
    });
    rerender({ committed: "ecoli" });

    expect(result.current[0]).toBe("ecoli");
    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs * 3);
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("keeps a keystroke typed before its own commit lands", () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedDraft(committed, commit),
      { initialProps: { committed: "" } },
    );

    act(() => {
      result.current[1]("ec");
    });
    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs);
    });
    expect(commit).toHaveBeenLastCalledWith("ec");

    // The user types again while the write of "ec" is still pending.
    act(() => {
      result.current[1]("eco");
    });
    rerender({ committed: "ec" });
    expect(result.current[0]).toBe("eco");

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs);
    });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenLastCalledWith("eco");
  });

  it("commits the normalized draft and keeps typing that follows it", () => {
    const commit = vi.fn();
    const normalize = (value: string) => value.trim();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedDraft(committed, commit, { normalize }),
      { initialProps: { committed: "" } },
    );

    act(() => {
      result.current[1]("eco ");
    });
    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs);
    });
    expect(commit).toHaveBeenLastCalledWith("eco");

    // The normalized value landing is this hook's own write, not an outside one.
    act(() => {
      result.current[1]("eco k");
    });
    rerender({ committed: "eco" });
    expect(result.current[0]).toBe("eco k");

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs);
    });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenLastCalledWith("eco k");
  });

  it("does not commit a draft that normalizes to the committed value", () => {
    const commit = vi.fn();
    const normalize = (value: string) => value.trim();
    const { result } = renderHook(() =>
      useDebouncedDraft("eco", commit, { normalize }),
    );

    act(() => {
      result.current[1]("eco ");
    });
    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs * 3);
    });
    expect(result.current[0]).toBe("eco ");
    expect(commit).not.toHaveBeenCalled();
  });

  it("still takes a later outside change to a value it committed earlier", () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedDraft(committed, commit),
      { initialProps: { committed: "" } },
    );

    act(() => {
      result.current[1]("eco");
    });
    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs);
    });
    rerender({ committed: "eco" });

    // Back to the entry before the search, then Forward to the entry after it.
    rerender({ committed: "" });
    expect(result.current[0]).toBe("");
    rerender({ committed: "eco" });
    expect(result.current[0]).toBe("eco");

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs * 3);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
