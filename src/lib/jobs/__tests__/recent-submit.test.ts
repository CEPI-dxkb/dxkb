import { QueryClient } from "@tanstack/react-query";
import { clearAccountCaches } from "@/lib/account-caches";
import {
  invalidateJobsQueries,
  isInSubmitWindow,
  markJobSubmitted,
  refreshJobsAfterSubmit,
  submitWindowMs,
} from "../recent-submit";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
});

afterEach(() => {
  clearAccountCaches();
  vi.useRealTimers();
});

describe("recent job submit window", () => {
  it("is closed until a job is submitted", () => {
    expect(isInSubmitWindow()).toBe(false);
  });

  it("stays open for 90 s after a submit, then closes", () => {
    expect(submitWindowMs).toBe(90_000);
    markJobSubmitted();
    expect(isInSubmitWindow()).toBe(true);
    vi.setSystemTime(Date.now() + 89_999);
    expect(isInSubmitWindow()).toBe(true);
    vi.setSystemTime(Date.now() + 1);
    expect(isInSubmitWindow()).toBe(false);
  });

  it("takes an explicit time", () => {
    markJobSubmitted();
    const now = Date.now();
    expect(isInSubmitWindow(now + 1_000)).toBe(true);
    expect(isInSubmitWindow(now + 90_000)).toBe(false);
  });

  it("restarts the window on a later submit", () => {
    markJobSubmitted();
    vi.setSystemTime(Date.now() + 60_000);
    markJobSubmitted();
    vi.setSystemTime(Date.now() + 60_000);
    expect(isInSubmitWindow()).toBe(true);
  });

  it("closes when the account changes", () => {
    markJobSubmitted();
    clearAccountCaches();
    expect(isInSubmitWindow()).toBe(false);
  });

  it("marks the window and invalidates the jobs summary and list", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    refreshJobsAfterSubmit(queryClient);
    expect(isInSubmitWindow()).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobs-summary"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobs-filtered"] });
  });

  it("can refresh the jobs queries without opening the window", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    invalidateJobsQueries(queryClient);
    expect(isInSubmitWindow()).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobs-summary"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobs-filtered"] });
  });
});
