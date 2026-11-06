"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { copilotQueryKeys } from "@/lib/copilot/client";
import type { CopilotWorkflowWatch } from "@/lib/copilot/types";

/**
 * Jobs the chat waits for: when one ends, the gateway writes a completion
 * message into the chat a moment later; reload it then.
 */
export function useWorkflowWatchReload(
  sessionId: string | null,
  watches: CopilotWorkflowWatch[] | undefined,
  queryClient: QueryClient,
) {
  const watchingRef = useRef<{ sessionId: string; ids: Set<string> } | null>(
    null,
  );
  useEffect(() => {
    if (!sessionId || !watches) return;
    const running = new Set<string>();
    for (const watch of watches) {
      if (watch.status === "active") running.add(watch.submissionId);
    }
    const before =
      watchingRef.current?.sessionId === sessionId
        ? watchingRef.current.ids
        : null;
    watchingRef.current = { sessionId, ids: running };
    if (!before || [...before].every((id) => running.has(id))) return;
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({
        queryKey: copilotQueryKeys.session(sessionId),
        exact: true,
      });
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [watches, sessionId, queryClient]);
}
