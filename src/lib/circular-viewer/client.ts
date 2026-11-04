/**
 * Browser side of `/api/circular-viewer/[operation]`, kept apart from
 * `./server.ts` so no Data API registry reaches a client bundle. Answers are
 * cached only by TanStack Query (these keys), so `queryClient.clear()` on an
 * account change drops them and nothing registers with `account-caches.ts`.
 */
import { httpFailure } from "@/lib/data-api/route-failure-client";
import { toQueryString } from "@/lib/url";
import type {
  CircularContigsResult,
  CircularTrackResult,
  CircularViewerOperation,
  CustomTrackQuery,
  GcResult,
  PresetTrackId,
} from "./contract";

const basePath = "/api/circular-viewer";

export const circularViewerQueryKeys = {
  all: ["circular-viewer"] as const,
  contigs: (genomeId: string) =>
    [...circularViewerQueryKeys.all, "contigs", genomeId] as const,
  track: (genomeId: string, preset: PresetTrackId) =>
    [...circularViewerQueryKeys.all, "track", genomeId, preset] as const,
  custom: (genomeId: string, query: CustomTrackQuery) =>
    [
      ...circularViewerQueryKeys.all,
      "custom",
      genomeId,
      query.type,
      query.strand,
      query.keyword,
    ] as const,
  gc: (genomeId: string) =>
    [...circularViewerQueryKeys.all, "gc", genomeId] as const,
};

async function getJson<T>(
  operation: CircularViewerOperation,
  query: Record<string, string>,
  subject: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `${basePath}/${operation}?${toQueryString(new URLSearchParams(query))}`,
    { credentials: "include", signal },
  );
  if (!response.ok) throw await httpFailure(response, subject);
  return (await response.json()) as T;
}

export function loadContigs(genomeId: string, signal?: AbortSignal) {
  return getJson<CircularContigsResult>(
    "contigs",
    { genomeId },
    `sequences of genome ${genomeId}`,
    signal,
  );
}

export function loadPresetTrack(
  genomeId: string,
  preset: PresetTrackId,
  signal?: AbortSignal,
) {
  return getJson<CircularTrackResult>(
    "track",
    { genomeId, preset },
    `${preset} features of genome ${genomeId}`,
    signal,
  );
}

export function loadCustomTrack(
  genomeId: string,
  query: CustomTrackQuery,
  signal?: AbortSignal,
) {
  return getJson<CircularTrackResult>(
    "custom",
    {
      genomeId,
      type: query.type,
      strand: query.strand,
      keyword: query.keyword,
    },
    `features matching "${query.keyword}"`,
    signal,
  );
}

export function loadGc(genomeId: string, signal?: AbortSignal) {
  return getJson<GcResult>(
    "gc",
    { genomeId },
    `GC content of genome ${genomeId}`,
    signal,
  );
}
