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

  it("replaces the entry while typing a search", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useJobsUrlState());
    result.current[1]({ search: "ecoli" }, { history: "replace" });
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/jobs?status=failed&q=ecoli&page=3",
    );
  });

  it("writes nothing for a change that leaves the address as it is", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useJobsUrlState());
    // The current page number, and a date cleared when none is applied.
    result.current[1]({ page: 3 });
    result.current[1]({ dateFrom: undefined, dateTo: undefined });
    result.current[1]({ status: "failed" }, { history: "replace" });
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
    result.current[1]({ search: "ecoli" }, { history: "replace" });
    expect(window.location.pathname + window.location.search).toBe(
      "/jobs?status=completed&q=ecoli&page=3",
    );
  });
});
