import type { ScoreScale } from "./paths";

export const userPlotTypes = ["tiles", "line", "histogram", "heatmap"] as const;
export type UserPlotType = (typeof userPlotTypes)[number];

export function isUserPlotType(value: unknown): value is UserPlotType {
  return (userPlotTypes as readonly unknown[]).includes(value);
}

export interface UserTrackItem {
  accession: string;
  start: number;
  end: number;
  score: number | null;
}

export interface ParsedUserTrack {
  items: UserTrackItem[];
  scale: ScoreScale;
  skipped: number;
}

export const maxUserFileBytes = 20 * 1024 * 1024;

/** A 20 MB file can hold 800k rows, which takes 1.7 s and about 1.2 GB of heap to draw. */
export const maxUserTrackRows = 100_000;

export const userFileAccept = ".txt,.tsv,.tab,text/plain,text/tab-separated-values";

export function userScoreScale(min: number, max: number): ScoreScale {
  if (max <= 1 && max > 0 && min >= 0) return { min: 0, max: 1 };
  if (max <= 1 && max > 0 && min < 0 && min >= -1) return { min: -1, max: 1 };
  if (max > 1 && min >= 0) return { min: 0, max };
  const magnitude = Math.max(Math.abs(max), Math.abs(min));
  return { min: -magnitude, max: magnitude };
}

function itemsScale(items: readonly UserTrackItem[]): ScoreScale {
  let min = 0;
  let max = 0;
  for (const { score } of items) {
    if (score === null) continue;
    min = Math.min(min, score);
    max = Math.max(max, score);
  }
  return userScoreScale(min, max);
}

const wholeNumber = /^\d+$/;
const decimalNumber = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function readPosition(cell: string): number | null {
  const text = cell.trim();
  if (!wholeNumber.test(text)) return null;
  const position = Number(text);
  return Number.isSafeInteger(position) && position >= 1 ? position : null;
}

function readScore(cell: string): number | null {
  const text = cell.trim();
  if (!decimalNumber.test(text)) return null;
  const score = Number(text);
  return Number.isFinite(score) ? score : null;
}

/**
 * Each number must fill its cell, so `1e3` or `0.5junk` skips the row (which
 * the upload warns of) rather than drawing it at `1` or `0.5`.
 */
export function parseUserTrack(text: string, plot: UserPlotType): ParsedUserTrack {
  const items: UserTrackItem[] = [];
  let skipped = 0;
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (line.trim() === "") continue;
    const cells = line.split("\t");
    const [rawAccession = "", rawStart = "", rawEnd = "", rawScore = ""] = cells;
    const accession = rawAccession.trim();
    const start = readPosition(rawStart);
    const end = readPosition(rawEnd);
    const readable = accession !== "" && start !== null && end !== null && end >= start;
    if (readable && cells.length > 3) {
      const score = readScore(rawScore);
      if (score !== null) {
        items.push({ accession, start, end, score });
        continue;
      }
    } else if (readable && cells.length === 3 && plot === "tiles") {
      items.push({ accession, start, end, score: null });
      continue;
    }
    skipped += 1;
  }
  items.sort((a, b) => a.start - b.start || a.end - b.end);
  return { items, scale: itemsScale(items), skipped };
}

/**
 * Rows starting past their sequence's end are dropped (they would draw
 * zero-width); one overlapping the end is kept and drawn clamped.
 */
export function keepSequences(
  parsed: ParsedUserTrack,
  lengths: ReadonlyMap<string, number>,
): { parsed: ParsedUserTrack; offSequence: number; pastEnd: number } {
  let offSequence = 0;
  let pastEnd = 0;
  const items = parsed.items.filter((item) => {
    const length = lengths.get(item.accession);
    if (length === undefined) {
      offSequence += 1;
      return false;
    }
    if (item.start > length) {
      pastEnd += 1;
      return false;
    }
    return true;
  });
  if (offSequence === 0 && pastEnd === 0) return { parsed, offSequence, pastEnd };
  return { parsed: { ...parsed, items, scale: itemsScale(items) }, offSequence, pastEnd };
}
