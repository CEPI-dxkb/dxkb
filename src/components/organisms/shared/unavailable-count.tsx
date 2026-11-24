"use client";

import { Loader2Icon } from "lucide-react";
import { useId } from "react";
import { useCountRetry } from "@/components/organisms/shared/count-retry-scope";

/**
 * A stat tile's figure for a count whose load failed: a red "Unavailable" that
 * retries the load (the `CountRetryScope` around it) and spins while that
 * runs. The page shows no error text, but the original reason is kept in a
 * hidden described-by target (and in the tile's description, see
 * `failedCountDescription`), so the accessible name stays the visible
 * "Unavailable". No native `title`: it would draw over the value beside the
 * tile's own tooltip. The spinner is decorative; `aria-busy` says the button
 * is busy. While retrying it is `aria-disabled` and ignores clicks rather than
 * natively `disabled`, which would drop a keyboard user's focus to the page;
 * so it carries its own not-allowed cursor (the base-layer rule matches only
 * `:disabled`). A tile showing it must not be a link, which the button would
 * nest inside.
 */
export function UnavailableCount({ reason }: { reason: string }) {
  const { isRetrying, retry } = useCountRetry();
  const reasonId = useId();
  const hint = `Click to retry. ${reason}`;
  return (
    <>
      <button
        type="button"
        aria-describedby={reasonId}
        aria-busy={isRetrying || undefined}
        aria-disabled={isRetrying || undefined}
        onClick={() => {
          if (!isRetrying) retry();
        }}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-destructive underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:no-underline"
      >
        Unavailable
        {isRetrying ? (
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
        ) : null}
      </button>
      <span id={reasonId} hidden>
        {hint}
      </span>
    </>
  );
}
