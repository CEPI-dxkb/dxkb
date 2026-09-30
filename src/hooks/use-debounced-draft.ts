"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { keywordDebounceMs } from "@/components/filterbar/keyword-search";

/**
 * A text box's draft over a committed value that lives elsewhere (usually the
 * URL), committed after `delayMs` of no typing.
 *
 * Next applies History API writes to `useSearchParams` inside a transition, so
 * a text input bound straight to the URL snaps back to the old value on each
 * keystroke and drops fast typing. The box shows the draft instead.
 *
 * - The draft starts as `committed`, and mounting never commits.
 * - A `committed` value that changes from outside (Back/Forward, a link)
 *   replaces the draft, without committing it back.
 * - A `committed` value that is this hook's own write landing does not: the
 *   user may have typed on since, and that text must survive.
 *
 * `commit` runs through an effect event, so it always sees the latest props.
 */
export function useDebouncedDraft(
  committed: string,
  commit: (value: string) => void,
  delayMs: number = keywordDebounceMs,
): readonly [string, (value: string) => void] {
  const [draft, setDraft] = useState(committed);
  const [previousCommitted, setPreviousCommitted] = useState(committed);
  // What this hook last committed, until a committed value lands.
  const [ownCommit, setOwnCommit] = useState<string | null>(null);
  if (previousCommitted !== committed) {
    setPreviousCommitted(committed);
    setOwnCommit(null);
    if (committed !== ownCommit) setDraft(committed);
  }

  const commitDraft = useEffectEvent((value: string) => {
    setOwnCommit(value);
    commit(value);
  });

  useEffect(() => {
    if (draft === committed) return;
    const timeout = setTimeout(() => {
      commitDraft(draft);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [committed, delayMs, draft]);

  return [draft, setDraft];
}
