/**
 * Browser side of `/api/genome-browser/[operation]`, kept apart from `./server.ts` so no Data API registry or Zod schema reaches a client bundle.
 * The panel and the JBrowse adapters share these caches, so regions the panel loaded are what `getRegions` returns.
 */
import { registerAccountCacheClear } from "@/lib/account-caches";
import { httpFailure } from "@/lib/data-api/route-failure-client";
import { toQueryString } from "@/lib/url";
import { BoundedCache } from "./bounded-cache";
import { loadChunks } from "./chunks";
import {
  featureChunkSize,
  formatLocation,
  maxFeatureRows,
  maxFeatureSpan,
  maxSequenceSpan,
  sequenceChunkSize,
  type GenomeBrowserAnnotation,
  type GenomeBrowserFeature,
  type GenomeBrowserFeaturesResult,
  type GenomeBrowserRegion,
  type GenomeBrowserRegionsResult,
  type GenomeBrowserSequenceResult,
} from "./contract";

const genomeBrowserBasePath = "/api/genome-browser";

export const genomeBrowserQueryKeys = {
  all: ["genome-browser"] as const,
  regions: (genomeId: string) =>
    [...genomeBrowserQueryKeys.all, "regions", genomeId] as const,
};

async function getJson<T>(
  operation: string,
  query: Record<string, string>,
  subject: string,
): Promise<T> {
  const response = await fetch(
    `${genomeBrowserBasePath}/${operation}?${toQueryString(new URLSearchParams(query))}`,
    { credentials: "include" },
  );
  if (!response.ok) throw await httpFailure(response, subject);
  return (await response.json()) as T;
}

const regionsCache = new BoundedCache<Promise<GenomeBrowserRegion[]>>({
  maxWeight: 20,
});
const featureChunks = new BoundedCache<Promise<GenomeBrowserFeature[]>>({
  maxWeight: 300,
});
const sequenceChunks = new BoundedCache<Promise<string>>({ maxWeight: 250 });

/** Account-change invalidation: these caches sit outside `queryClient.clear()`'s reach, so `clearAccountCaches()` (registered on load) clears them; tests call it too. */
export function clearGenomeBrowserCaches(): void {
  regionsCache.clear();
  featureChunks.clear();
  sequenceChunks.clear();
}

registerAccountCacheClear(clearGenomeBrowserCaches);

export function loadGenomeBrowserRegions(
  genomeId: string,
): Promise<GenomeBrowserRegion[]> {
  const cached = regionsCache.get(genomeId);
  if (cached) return cached;
  const loading = getJson<GenomeBrowserRegionsResult>(
    "regions",
    { genomeId },
    `Genome Browser sequences of ${genomeId}`,
  ).then((result) => result.regions);
  regionsCache.set(genomeId, loading);
  void loading.catch(() => {
    regionsCache.deleteIfCurrent(genomeId, loading);
  });
  return loading;
}

export interface FeatureTrackQuery {
  genomeId: string;
  annotation: GenomeBrowserAnnotation;
  refName: string;
}

export async function loadGenomeBrowserFeatures(
  track: FeatureTrackQuery,
  start: number,
  end: number,
): Promise<GenomeBrowserFeature[]> {
  const chunks = await loadChunks({
    cache: featureChunks,
    key: `${track.genomeId}|${track.annotation}|${track.refName}`,
    chunkSize: featureChunkSize,
    maxChunksPerRequest: maxFeatureSpan / featureChunkSize,
    start,
    end,
    fetchSpan: async (spanStart, spanEnd) => {
      const result = await getJson<GenomeBrowserFeaturesResult>(
        "features",
        {
          genomeId: track.genomeId,
          refName: track.refName,
          annotation: track.annotation,
          start: String(spanStart),
          end: String(spanEnd),
        },
        `${track.annotation} features`,
      );
      if (result.truncated) {
        throw new Error(
          `More than ${maxFeatureRows.toLocaleString("en-US")} ${track.annotation} features in ${formatLocation(track.refName, spanStart + 1, spanEnd)}; zoom in to see them.`,
        );
      }
      return result.features;
    },
    sliceChunk: (features, chunkStart, chunkEnd) =>
      features.filter(
        (feature) => feature.start < chunkEnd && feature.end > chunkStart,
      ),
  });
  const seen = new Set<string>();
  return chunks.flat().filter((feature) => {
    if (feature.end <= start || feature.start >= end) return false;
    if (seen.has(feature.uniqueId)) return false;
    seen.add(feature.uniqueId);
    return true;
  });
}

export async function loadGenomeBrowserSequence(
  sequence: { genomeId: string; refName: string },
  start: number,
  end: number,
): Promise<string> {
  const chunks = await loadChunks({
    cache: sequenceChunks,
    key: `${sequence.genomeId}|${sequence.refName}`,
    chunkSize: sequenceChunkSize,
    maxChunksPerRequest: maxSequenceSpan / sequenceChunkSize,
    start,
    end,
    fetchSpan: (spanStart, spanEnd) =>
      getJson<GenomeBrowserSequenceResult>(
        "sequence",
        {
          genomeId: sequence.genomeId,
          refName: sequence.refName,
          start: String(spanStart),
          end: String(spanEnd),
        },
        `Sequence of ${sequence.refName}`,
      ),
    sliceChunk: (result, chunkStart, chunkEnd) =>
      result.seq.slice(
        Math.max(0, chunkStart - result.start),
        Math.max(0, chunkEnd - result.start),
      ),
  });
  const firstChunkStart =
    Math.floor(start / sequenceChunkSize) * sequenceChunkSize;
  return chunks
    .join("")
    .slice(start - firstChunkStart, end - firstChunkStart);
}
