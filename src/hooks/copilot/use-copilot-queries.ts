"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  copilotQueryKeys,
  fetchCopilotModels,
  fetchCopilotSession,
  fetchCopilotSessions,
  fetchCopilotWorkflowWatches,
} from "@/lib/copilot/client";

const sessionPageSize = 20;

/** The gateway's chat models. They change rarely; kept for the visit. */
export function useCopilotModels(enabled: boolean) {
  return useQuery({
    queryKey: copilotQueryKeys.models(),
    queryFn: ({ signal }) => fetchCopilotModels(signal),
    enabled,
    staleTime: Infinity,
  });
}

/** The user's sessions, newest first, 20 at a time. */
export function useCopilotSessions(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: copilotQueryKeys.sessions(),
    queryFn: ({ pageParam, signal }) =>
      fetchCopilotSessions({ limit: sessionPageSize, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore
        ? pages.reduce((count, page) => count + page.sessions.length, 0)
        : undefined,
    enabled,
  });
}

/**
 * One session's messages. While the gateway reports a turn running in it and
 * this tab is not streaming that turn (it was started elsewhere, or the
 * stream dropped), the session is polled every 3 s until the turn ends.
 */
export function useCopilotSession(
  sessionId: string | null,
  options: { enabled: boolean; streaming: boolean },
) {
  return useQuery({
    queryKey: copilotQueryKeys.session(sessionId ?? ""),
    queryFn: ({ signal }) => fetchCopilotSession(sessionId ?? "", signal),
    enabled: options.enabled && sessionId !== null,
    refetchInterval: (query) =>
      !options.streaming && query.state.data?.activeJobId ? 3000 : false,
  });
}

/** How often jobs a chat waits for are checked (BV-BRC's interval). */
export const copilotWatchPollMs = 30_000;

/**
 * The jobs the gateway watches for a session. Read when the chat opens and
 * after each turn; while one is still running, every 30 s. When one ends the
 * gateway writes a completion message into the chat (see `CopilotPanel`).
 */
export function useCopilotWorkflowWatches(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: copilotQueryKeys.workflowWatches(sessionId ?? ""),
    queryFn: ({ signal }) => fetchCopilotWorkflowWatches(sessionId ?? "", signal),
    enabled: enabled && sessionId !== null,
    refetchInterval: (query) =>
      query.state.data?.some((watch) => watch.status === "active")
        ? copilotWatchPollMs
        : false,
  });
}
