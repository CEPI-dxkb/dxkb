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

export function useCopilotModels(enabled: boolean) {
  return useQuery({
    queryKey: copilotQueryKeys.models(),
    queryFn: ({ signal }) => fetchCopilotModels(signal),
    enabled,
    staleTime: Infinity,
  });
}

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

export function copilotSessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: copilotQueryKeys.session(sessionId),
    queryFn: ({ signal }) => fetchCopilotSession(sessionId, signal),
  });
}

/** Resolves `null` once a fetch started after this call has delivered data, else the failure's message. An in-flight fetch is cancelled first since joining it could return old messages. */
export async function reloadCopilotSession(
  queryClient: QueryClient,
  sessionId: string,
): Promise<string | null> {
  const options = copilotSessionQueryOptions(sessionId);
  const queryHash = hashKey(options.queryKey);
  // Only a fetch's own write counts, not `setQueryData` (`manual`) or a cancel's revert.
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
    // A cancel reverts this fetch (old data or `CancelledError`); join the replacing fetch until one delivers.
    while (!hasDelivered()) {
      try {
        await queryClient.query({ ...options, staleTime: 0 });
      } catch (cause) {
        if (!(cause instanceof CancelledError && cause.revert === true)) throw cause;
      }
    }
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : "Could not reload the chat.";
  } finally {
    unsubscribe();
  }
}

// Per cache: deliveries per session. One listener counts from the first read so late subscribers see earlier deliveries.
const sessionDeliveryCounts = new WeakMap<QueryCache, Map<string, number>>();
const sessionKeyPrefix = copilotQueryKeys.session("").slice(0, 2);

function sessionDeliveries(cache: QueryCache): Map<string, number> {
  const known = sessionDeliveryCounts.get(cache);
  if (known) return known;
  const counts = new Map<string, number>();
  sessionDeliveryCounts.set(cache, counts);
  cache.subscribe((event) => {
    // Same filter as `reloadCopilotSession`.
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

/** Only a later, larger count means newer data arrived. */
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

/** Polled every 3 s while the gateway reports a turn running that this tab is not streaming. */
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

export const copilotWatchPollMs = 30_000;

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
