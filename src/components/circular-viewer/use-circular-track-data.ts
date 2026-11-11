"use client";

import { hashKey, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  circularViewerQueryKeys,
  loadCustomTrack,
  loadGc,
  loadPresetTrack,
} from "@/lib/circular-viewer/client";
import type {
  CircularContig,
  CircularTrackResult,
} from "@/lib/circular-viewer/contract";
import { pendingTrackData, type TrackData } from "@/lib/circular-viewer/drawing";
import { gcPoints, type TrackItems } from "@/lib/circular-viewer/track-items";
import type { CircularTrack } from "@/lib/circular-viewer/tracks";
import type { TrackError } from "./circular-viewer-track-list";

const forever = Number.POSITIVE_INFINITY;

export interface RetryableQuery {
  key: string;
  error: Error | null;
  isFetching: boolean;
  refetch: () => unknown;
}

/**
 * TanStack resets a query with no data to `pending` with its error cleared the
 * moment it refetches; the error is kept until the retry answers.
 */
export function useRetriesKeepingErrors(
  queries: readonly RetryableQuery[],
): ReadonlyMap<string, TrackError> {
  const [kept, setKept] = useState<ReadonlyMap<string, Error>>(new Map());
  const byKey = new Map(queries.map((query) => [query.key, query]));
  const settled = [...kept].filter(([key, error]) => {
    const query = byKey.get(key);
    return (
      query === undefined ||
      (!query.isFetching && (query.error === null || query.error !== error))
    );
  });
  if (settled.length > 0) {
    const next = new Map(kept);
    for (const [key] of settled) next.delete(key);
    setKept(next);
  }
  const settledKeys = new Set(settled.map(([key]) => key));

  const failures = new Map<string, TrackError>();
  for (const query of queries) {
    const keptError = settledKeys.has(query.key) ? undefined : kept.get(query.key);
    const error = query.error ?? keptError;
    if (error === undefined) continue;
    failures.set(query.key, {
      error,
      isFetching: query.isFetching,
      retry: () => {
        setKept((current) => new Map(current).set(query.key, error));
        void query.refetch();
      },
    });
  }
  return failures;
}

interface RemoteTrack {
  trackId: string;
  queryKey: readonly unknown[];
  load: (signal: AbortSignal) => Promise<CircularTrackResult>;
}

function remoteTrack(genomeId: string, track: CircularTrack): RemoteTrack | null {
  const { source } = track;
  if (source.kind === "preset") {
    const { preset } = source;
    return {
      trackId: track.id,
      queryKey: circularViewerQueryKeys.track(genomeId, preset),
      load: (signal) => loadPresetTrack(genomeId, preset, signal),
    };
  }
  if (source.kind === "custom") {
    const { query } = source;
    return {
      trackId: track.id,
      queryKey: circularViewerQueryKeys.custom(genomeId, query),
      load: (signal) => loadCustomTrack(genomeId, query, signal),
    };
  }
  return null;
}

/** Module-level, so TanStack keeps its result while the answer is unchanged. */
function featureItems(result: CircularTrackResult): TrackItems {
  return { kind: "features", features: result.features, truncated: result.truncated };
}

export interface CircularTrackData {
  data: ReadonlyMap<string, TrackData>;
  gcWindowSize: number | undefined;
  errors: ReadonlyMap<string, TrackError>;
}

export function useCircularTrackData(
  genomeId: string,
  tracks: readonly CircularTrack[],
  contigs: readonly CircularContig[] | undefined,
): CircularTrackData {
  const enabled = contigs !== undefined && contigs.length > 0;
  const remote = tracks.flatMap((track) => {
    const entry = remoteTrack(genomeId, track);
    return entry ? [{ ...entry, hash: hashKey(entry.queryKey) }] : [];
  });
  // `useQueries` with a key twice warns and mixes up their results.
  const distinct = [...new Map(remote.map((entry) => [entry.hash, entry])).values()];
  const features = useQueries({
    queries: distinct.map((entry) => ({
      queryKey: entry.queryKey,
      queryFn: ({ signal }: { signal: AbortSignal }) => entry.load(signal),
      select: featureItems,
      staleTime: forever,
      enabled,
    })),
  });
  const byHash = new Map(distinct.map((entry, index) => [entry.hash, features[index]]));
  const gcKey = circularViewerQueryKeys.gc(genomeId);
  const gc = useQuery({
    queryKey: gcKey,
    queryFn: ({ signal }) => loadGc(genomeId, signal),
    staleTime: forever,
    enabled: enabled && tracks.some((track) => track.source.kind === "gc"),
  });
  const gcContent = useMemo<TrackItems | undefined>(
    () => (gc.data ? { kind: "scores", points: gcPoints(gc.data, "content") } : undefined),
    [gc.data],
  );
  const gcSkew = useMemo<TrackItems | undefined>(
    () => (gc.data ? { kind: "scores", points: gcPoints(gc.data, "skew") } : undefined),
    [gc.data],
  );
  const contigItems = useMemo<TrackItems | undefined>(
    () => (contigs ? { kind: "contigs", contigs } : undefined),
    [contigs],
  );

  const gcHash = hashKey(gcKey);
  const failures = useRetriesKeepingErrors([
    ...distinct.map((entry, index) => ({
      key: entry.hash,
      error: features[index].error,
      isFetching: features[index].isFetching,
      refetch: features[index].refetch,
    })),
    { key: gcHash, error: gc.error, isFetching: gc.isFetching, refetch: gc.refetch },
  ]);

  const data = new Map<string, TrackData>();
  const errors = new Map<string, TrackError>();
  for (const entry of remote) {
    const query = byHash.get(entry.hash);
    const failure = failures.get(entry.hash);
    if (failure) errors.set(entry.trackId, failure);
    if (query?.error) data.set(entry.trackId, { status: "error", error: query.error });
    else if (query?.data === undefined) data.set(entry.trackId, pendingTrackData);
    else data.set(entry.trackId, { status: "ready", items: query.data });
  }
  const gcFailure = failures.get(gcHash);
  for (const track of tracks) {
    const { source } = track;
    if (source.kind === "labels" || source.kind === "contigs") {
      data.set(track.id, contigItems ? { status: "ready", items: contigItems } : pendingTrackData);
    } else if (source.kind === "gc") {
      if (gcFailure) errors.set(track.id, gcFailure);
      const items = source.metric === "content" ? gcContent : gcSkew;
      data.set(
        track.id,
        gc.error
          ? { status: "error", error: gc.error }
          : items
            ? { status: "ready", items }
            : pendingTrackData,
      );
    } else if (source.kind === "user") {
      data.set(track.id, { status: "ready", items: source.items });
    }
  }

  return { data, gcWindowSize: gc.data?.windowSize, errors };
}
