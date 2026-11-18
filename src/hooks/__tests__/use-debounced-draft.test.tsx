import { Activity } from "react";
import { act, render, renderHook } from "@testing-library/react";
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

    rerender({ committed: "" });
    expect(result.current[0]).toBe("");
    rerender({ committed: "eco" });
    expect(result.current[0]).toBe("eco");

    act(() => {
      vi.advanceTimersByTime(keywordDebounceMs * 3);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  describe("flushOnUnmount", () => {
    it("commits an uncommitted draft once when unmounted before the debounce", () => {
      const commit = vi.fn();
      const { result, unmount } = renderHook(() =>
        useDebouncedDraft("", commit, { flushOnUnmount: true }),
      );

      act(() => {
        result.current[1]("half-typed");
      });
      unmount();

      expect(commit).toHaveBeenCalledExactlyOnceWith("half-typed");
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs * 3);
      });
      expect(commit).toHaveBeenCalledOnce();
    });

    it("commits the normalized draft on unmount, and nothing when it normalizes to the committed value", () => {
      const commit = vi.fn();
      const normalize = (value: string) => value.trim();
      const first = renderHook(() =>
        useDebouncedDraft("", commit, { normalize, flushOnUnmount: true }),
      );
      act(() => {
        first.result.current[1]("  eco ");
      });
      first.unmount();
      expect(commit).toHaveBeenCalledExactlyOnceWith("eco");

      commit.mockClear();
      const second = renderHook(() =>
        useDebouncedDraft("eco", commit, { normalize, flushOnUnmount: true }),
      );
      act(() => {
        second.result.current[1]("eco ");
      });
      second.unmount();
      expect(commit).not.toHaveBeenCalled();
    });

    it("does not commit again on unmount once the debounce has committed the draft", () => {
      const commit = vi.fn();
      const { result, unmount } = renderHook(() =>
        useDebouncedDraft("", commit, { flushOnUnmount: true }),
      );

      act(() => {
        result.current[1]("eco");
      });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs);
      });
      expect(commit).toHaveBeenCalledExactlyOnceWith("eco");

      // The owner has not handed the commit back yet.
      unmount();
      expect(commit).toHaveBeenCalledOnce();
    });

    it("commits typing that followed its own commit when that commit lands late", () => {
      const commit = vi.fn();
      const { result, rerender, unmount } = renderHook(
        ({ committed }) =>
          useDebouncedDraft(committed, commit, { flushOnUnmount: true }),
        { initialProps: { committed: "" } },
      );

      act(() => {
        result.current[1]("eco");
      });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs);
      });
      act(() => {
        result.current[1]("eco k");
      });
      rerender({ committed: "eco" });
      unmount();

      expect(commit).toHaveBeenCalledTimes(2);
      expect(commit).toHaveBeenLastCalledWith("eco k");
    });

    it("does not commit a draft an outside change replaced", () => {
      const commit = vi.fn();
      const { result, rerender, unmount } = renderHook(
        ({ committed }) =>
          useDebouncedDraft(committed, commit, { flushOnUnmount: true }),
        { initialProps: { committed: "" } },
      );

      act(() => {
        result.current[1]("half-typ");
      });
      rerender({ committed: "fromTable" });
      unmount();

      expect(commit).not.toHaveBeenCalled();
    });

    it("flushes a draft once, however often its owner is hidden and shown before the commit lands", () => {
      const commit = vi.fn();
      let setDraft: (value: string) => void = () => undefined;
      function Box() {
        const [, setBoxDraft] = useDebouncedDraft("", commit, {
          flushOnUnmount: true,
        });
        setDraft = setBoxDraft;
        return null;
      }
      // Activity hides by running the effect cleanups and shows by running every effect again, the
      // replay `flushOnUnmount` has to survive without committing the same draft a second time.
      const ui = (mode: "visible" | "hidden") => (
        <Activity mode={mode}>
          <Box />
        </Activity>
      );
      const { rerender } = render(ui("visible"));

      act(() => {
        setDraft("eco");
      });
      rerender(ui("hidden"));
      expect(commit).toHaveBeenCalledExactlyOnceWith("eco");

      rerender(ui("visible"));
      rerender(ui("hidden"));
      expect(commit).toHaveBeenCalledOnce();
    });

    it("drops an uncommitted draft on unmount when not opted in", () => {
      const commit = vi.fn();
      const { result, unmount } = renderHook(() =>
        useDebouncedDraft("", commit),
      );

      act(() => {
        result.current[1]("half-typed");
      });
      unmount();
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs * 3);
      });

      expect(commit).not.toHaveBeenCalled();
    });
  });
});
