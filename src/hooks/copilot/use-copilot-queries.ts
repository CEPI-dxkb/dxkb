"use client";

import {
  CancelledError,
  hashKey,
  matchQuery,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryCache,
  type QueryClient,
} from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
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

/** The query for one session's messages, shared by its readers. */
export function copilotSessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: copilotQueryKeys.session(sessionId),
    queryFn: ({ signal }) => fetchCopilotSession(sessionId, signal),
  });
}

/**
 * Reads a session from the gateway now, whether or not anything shows it,
 * and resolves `null` once a fetch that started after this call (its own, or
 * one it joined) has delivered data to the cache, or the failure's message.
 * A fetch already in flight is cancelled first: it may have started before
 * the turn ended, and joining it would return the old messages.
 */
export async function reloadCopilotSession(
  queryClient: QueryClient,
  sessionId: string,
): Promise<string | null> {
  const options = copilotSessionQueryOptions(sessionId);
  const queryHash = hashKey(options.queryKey);
  // Only a fetch's own write counts: `setQueryData` (a rating's optimistic
  // update) is `manual`, and a cancel's revert dispatches no success at all.
  let delivered = false;
  // A call, so the loop's check is not narrowed to the `false` above.
  const hasDelivered = () => delivered;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.query.queryHash === queryHash &&
      event.action.type === "success" &&
      event.action.manual !== true
    ) {
      delivered = true;
    }
  });
  try {
    await queryClient.cancelQueries({ queryKey: options.queryKey, exact: true });
    // A cancel (a later reload's, or a rating's) reverts this fetch, which
    // then resolves with the old data, or throws `CancelledError` when there
    // was none. Join the fetch that replaced it, or start one, until a fetch
    // has delivered.
    while (!hasDelivered()) {
      try {
        await queryClient.query({ ...options, staleTime: 0 });
      } catch (cause) {
        if (!(cause instanceof CancelledError && cause.revert === true)) throw cause;
      }
    }
    return null;
  } catch (cause) {
    // A `CopilotClientError` carries the route's message verbatim.
    return cause instanceof Error ? cause.message : "Could not reload the chat.";
  } finally {
    unsubscribe();
  }
}

// Per cache: how many fetches have delivered each session's data since the
// count started. One listener per cache counts from the first read, so a
// reader that subscribes later still sees deliveries made in between.
const sessionDeliveryCounts = new WeakMap<QueryCache, Map<string, number>>();
const sessionKeyPrefix = copilotQueryKeys.session("").slice(0, 2);

function sessionDeliveries(cache: QueryCache): Map<string, number> {
  const known = sessionDeliveryCounts.get(cache);
  if (known) return known;
  const counts = new Map<string, number>();
  sessionDeliveryCounts.set(cache, counts);
  cache.subscribe((event) => {
    // The same filter as `reloadCopilotSession`: a fetch's own write, not
    // `setQueryData` (`manual`) and not a cancel's revert (no success).
    if (
      event.type === "updated" &&
      event.action.type === "success" &&
      event.action.manual !== true &&
      matchQuery({ queryKey: sessionKeyPrefix }, event.query)
    ) {
      counts.set(event.query.queryHash, (counts.get(event.query.queryHash) ?? 0) + 1);
    }
  });
  return counts;
}

/**
 * How many fetches have delivered this session's data to the cache so far.
 * Only a later, larger count means newer data arrived; the number itself
 * means nothing.
 */
export function copilotSessionDeliveries(
  queryClient: QueryClient,
  sessionId: string,
): number {
  return (
    sessionDeliveries(queryClient.getQueryCache()).get(
      hashKey(copilotQueryKeys.session(sessionId)),
    ) ?? 0
  );
}

/** `copilotSessionDeliveries`, re-read whenever the session's query changes. */
export function useCopilotSessionDeliveries(sessionId: string | null): number {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const queryHash = sessionId === null ? null : hashKey(copilotQueryKeys.session(sessionId));
  return useSyncExternalStore(
    (onChange) =>
      queryHash === null
        ? () => undefined
        : cache.subscribe((event) => {
            if (event.query.queryHash === queryHash) onChange();
          }),
    () => (queryHash === null ? 0 : (sessionDeliveries(cache).get(queryHash) ?? 0)),
    () => 0,
  );
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
    ...copilotSessionQueryOptions(sessionId ?? ""),
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
