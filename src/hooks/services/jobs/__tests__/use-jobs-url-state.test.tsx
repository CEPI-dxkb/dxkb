import { renderHook } from "@testing-library/react";
import { useJobsUrlState } from "../use-jobs-url-state";

vi.mock("next/navigation", () => ({
  usePathname: () => "/jobs",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/jobs?status=failed&page=3");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useJobsUrlState", () => {
  it("reads the list state from the URL", () => {
    const { result } = renderHook(() => useJobsUrlState());
    expect(result.current[0]).toMatchObject({ status: "failed", page: 3 });
  });

  it("pushes a history entry for a filter change, keeping readable params", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({
      status: "completed",
      sort: { field: "app", direction: "asc" },
      page: 1,
    });
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/jobs?status=completed&sort=app:asc",
    );
  });

  it("gives successive search edits one entry of their own", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useJobsUrlState());

    result.current[1]({ status: "completed" });
    result.current[1]({ search: "eco" }, { history: "coalesce" });
    result.current[1]({ search: "ecoli" }, { history: "coalesce" });

    // The status entry survives: the search pushes once, then extends its own entry.
    expect(pushState.mock.calls.map(([, , url]) => url)).toStrictEqual([
      "/jobs?status=completed&page=3",
      "/jobs?status=completed&q=eco&page=3",
    ]);
    expect(replaceState).toHaveBeenCalledExactlyOnceWith(
      null,
      "",
      "/jobs?status=completed&q=ecoli&page=3",
    );
  });

  it("starts a new search entry after another write", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useJobsUrlState());

    result.current[1]({ search: "eco" }, { history: "coalesce" });
    result.current[1]({ status: "completed" });
    result.current[1]({ search: "ecoli" }, { history: "coalesce" });

    expect(pushState).toHaveBeenCalledTimes(3);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("starts a new search entry once the address has moved off its own", () => {
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({ search: "eco" }, { history: "coalesce" });

    // Back (or a link) lands on an entry this search did not write.
    window.history.replaceState(null, "", "/jobs?status=failed&page=3");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    result.current[1]({ search: "ecoli" }, { history: "coalesce" });

    expect(pushState).toHaveBeenCalledExactlyOnceWith(
      null,
      "",
      "/jobs?status=failed&q=ecoli&page=3",
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("writes nothing for a change that leaves the address as it is", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useJobsUrlState());
    // The current page number, and a date cleared when none is applied.
    result.current[1]({ page: 3 });
    result.current[1]({ dateFrom: undefined, dateTo: undefined });
    result.current[1]({ status: "failed" }, { history: "coalesce" });
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("does not mistake a different param order for a change", () => {
    window.history.replaceState(null, "", "/jobs?page=3&status=failed");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({});
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("keeps params the list does not own, ahead of the ones it does", () => {
    window.history.replaceState(null, "", "/jobs?status=failed&utm_source=x");
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({ page: 2 });
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/jobs?utm_source=x&status=failed&page=2",
    );
  });

  it("starts a new search entry after Back to an entry with the same address", async () => {
    window.history.replaceState(null, "", "/jobs?status=failed&q=eco&page=3");
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({ search: "ecoli" }, { history: "coalesce" });
    // Editing back to the landing value leaves this entry at the landing address.
    result.current[1]({ search: "eco" }, { history: "coalesce" });

    await new Promise((resolve) => {
      window.addEventListener("popstate", resolve, { once: true });
      window.history.back();
    });
    expect(window.location.search).toBe("?status=failed&q=eco&page=3");

    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    result.current[1]({ search: "ecol" }, { history: "coalesce" });

    // The landing entry is not the search's own, so it keeps its state.
    expect(pushState).toHaveBeenCalledExactlyOnceWith(
      null,
      "",
      "/jobs?status=failed&q=ecol&page=3",
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("keeps the hash, with or without a query", () => {
    window.history.replaceState(null, "", "/jobs?status=failed#results");
    const { result } = renderHook(() => useJobsUrlState());

    result.current[1]({ page: 2 });
    expect(window.location.pathname + window.location.search).toBe(
      "/jobs?status=failed&page=2",
    );
    expect(window.location.hash).toBe("#results");

    result.current[1]({ status: "all", page: 1 }, { history: "coalesce" });
    expect(window.location.pathname + window.location.search).toBe("/jobs");
    expect(window.location.hash).toBe("#results");
  });

  it("keeps an unrelated param when every list param is cleared", () => {
    window.history.replaceState(null, "", "/jobs?utm_source=x&status=failed");
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({ status: "all" });
    expect(window.location.pathname + window.location.search).toBe(
      "/jobs?utm_source=x",
    );
  });

  it("keeps both of two writes made in one tick", () => {
    // The hook's own render still holds the URL from before either write, as
    // it does while Next applies a History API write inside a transition.
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({ status: "completed" });
    result.current[1]({ search: "ecoli" }, { history: "coalesce" });
    expect(window.location.pathname + window.location.search).toBe(
      "/jobs?status=completed&q=ecoli&page=3",
    );
  });
});
