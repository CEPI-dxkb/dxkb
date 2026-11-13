import type { QueryClient } from "@tanstack/react-query";
import { registerAccountCacheClear } from "@/lib/account-caches";

/**
 * How long after a job submit (service form or Copilot) the jobs summary polls at the fast rate,
 * whatever its counts say, so the pill shows the new job even when the first refetch missed it.
 */
export const submitWindowMs = 90_000;

let lastSubmitAt: number | null = null;

export function markJobSubmitted(): void {
  lastSubmitAt = Date.now();
}

export function isInSubmitWindow(now: number = Date.now()): boolean {
  return lastSubmitAt !== null && now - lastSubmitAt < submitWindowMs;
}

/** Refreshes the jobs summary (pill) and the jobs list. */
export function invalidateJobsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
  void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
}

/** Opens the fast-poll window, then refreshes the jobs summary and list. */
export function refreshJobsAfterSubmit(queryClient: QueryClient): void {
  markJobSubmitted();
  invalidateJobsQueries(queryClient);
}

function clearRecentSubmit(): void {
  lastSubmitAt = null;
}

// Another account's submit must not speed up this account's polling.
registerAccountCacheClear(clearRecentSubmit);
