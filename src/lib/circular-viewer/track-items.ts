import type { CircularContig, CircularFeature, GcResult } from "./contract";
import type { UserTrackItem } from "./user-track";

export type GcMetric = "content" | "skew";

/** A scored window, 0-based half-open: GC windows and scored uploads. */
export interface ScorePoint {
  accession: string;
  start: number;
  end: number;
  score: number;
}

/** A track's data once loaded, whatever its source. */
export type TrackItems =
  | { kind: "contigs"; contigs: readonly CircularContig[] }
  | { kind: "features"; features: readonly CircularFeature[]; truncated: boolean }
  | { kind: "regions"; regions: readonly UserTrackItem[] }
  | { kind: "scores"; points: readonly ScorePoint[] };

export function gcPoints(result: GcResult, metric: GcMetric): ScorePoint[] {
  return result.contigs.flatMap((contig) =>
    (metric === "content" ? contig.gc : contig.skew).map((score, index) => ({
      accession: contig.accession,
      start: index * result.windowSize,
      end: Math.min(contig.length, (index + 1) * result.windowSize),
      score,
    })),
  );
}

export function userScorePoints(items: readonly UserTrackItem[]): ScorePoint[] {
  return items.flatMap((item) =>
    item.score === null
      ? []
      : [{ accession: item.accession, start: item.start - 1, end: item.end, score: item.score }],
  );
}

