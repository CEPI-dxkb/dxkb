"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useTransition, type ReactNode } from "react";
import { forgetFailedCounts } from "@/components/organisms/shared/forget-failed-counts";

interface CountRetry {
  /** A retry (the forget and the route refresh after it) is still running. */
  isRetrying: boolean;
  retry: () => void;
}

const CountRetryContext = createContext<CountRetry | null>(null);

/** A failed forget must not cost the retry: the refresh still reloads the counts that are not cached. */
function forgetFailedCountsOrLog(taxonIds: readonly number[]): Promise<void> {
  return forgetFailedCounts(taxonIds).catch((error: unknown) => {
    console.error("Could not reset the failed counts before retrying", error);
  });
}

/**
 * One retry for a row of stat tiles. It first asks the server to forget the
 * row's cached failed counts (`forgetFailedCounts`, for `taxonIds`), then
 * refreshes the route, which brings every failed count back, so the scope
 * owns that one transition and each `UnavailableCount` in it reads the same
 * pending state: one click spins them all, and none can queue a second
 * retry. Renders no DOM of its own.
 */
export function CountRetryScope({
  taxonIds,
  children,
}: {
  /** The taxa whose counts the row shows (a landing page's roots). */
  taxonIds: readonly number[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  const retry = () => {
    startRetry(async () => {
      await forgetFailedCountsOrLog(taxonIds);
      // An update after an `await` needs its own `startTransition` to stay
      // in this transition, so `isRetrying` lasts until the refresh is done.
      startRetry(() => {
        router.refresh();
      });
    });
  };
  return <CountRetryContext value={{ isRetrying, retry }}>{children}</CountRetryContext>;
}

export function useCountRetry(): CountRetry {
  const countRetry = use(CountRetryContext);
  if (!countRetry) {
    throw new Error(
      "UnavailableCount must be rendered inside a CountRetryScope, which owns its retry.",
    );
  }
  return countRetry;
}
