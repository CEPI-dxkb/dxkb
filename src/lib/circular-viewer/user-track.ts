import type { ScoreScale } from "./paths";

/** Legacy `TrackController`'s plot types (`tiles` is the default). */
export const userPlotTypes = ["tiles", "line", "histogram", "heatmap"] as const;
export type UserPlotType = (typeof userPlotTypes)[number];

export function isUserPlotType(value: unknown): value is UserPlotType {
  return (userPlotTypes as readonly unknown[]).includes(value);
}

/** One uploaded row, 1-based inclusive like the Data API's features. */
export interface UserTrackItem {
  accession: string;
  start: number;
  end: number;
  score: number | null;
}

export interface ParsedUserTrack {
  items: UserTrackItem[];
  scale: ScoreScale;
  /** Lines that were neither blank nor readable (a header, a bad number). */
  skipped: number;
}

/** A file this large would stall the tab while it is parsed and drawn. */
export const maxUserFileBytes = 20 * 1024 * 1024;

/**
 * Most rows an upload may draw. A 20 MB file can hold 800k rows, which takes
 * 1.7 s and about 1.2 GB of heap to draw, and every recolor redraws it.
 */
export const maxUserTrackRows = 100_000;

/** Legacy took `text/plain` only; a `.tsv` file has its own type. */
export const userFileAccept = ".txt,.tsv,.tab,text/plain,text/tab-separated-values";

/**
 * Legacy `validateUserFileSelection`'s range: `[0, 1]` for shares, `[-1, 1]`
 * for skews, `[0, max]` for positive data, else symmetric about 0. `min` and
 * `max` start at 0, as legacy's did.
 */
export function userScoreScale(min: number, max: number): ScoreScale {
  if (max <= 1 && max > 0 && min >= 0) return { min: 0, max: 1 };
  if (max <= 1 && max > 0 && min < 0 && min >= -1) return { min: -1, max: 1 };
  if (max > 1 && min >= 0) return { min: 0, max };
  const magnitude = Math.max(Math.abs(max), Math.abs(min));
  return { min: -magnitude, max: magnitude };
}

/** The scale of the items' scores; `min` and `max` start at 0, as legacy's did. */
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

/** A cell holding only a position, 1 or more; null for anything else. */
function readPosition(cell: string): number | null {
  const text = cell.trim();
  if (!wholeNumber.test(text)) return null;
  const position = Number(text);
  return Number.isSafeInteger(position) && position >= 1 ? position : null;
}

/** A cell holding only a finite decimal (`0.5`, `-.5`, `2.5e-1`); null for anything else. */
function readScore(cell: string): number | null {
  const text = cell.trim();
  if (!decimalNumber.test(text)) return null;
  const score = Number(text);
  return Number.isFinite(score) ? score : null;
}

/**
 * Tab-separated `accession start end [score]`, as legacy read uploads: a
 * fourth column is a score for every plot type, a three-column row counts
 * only for tiles, and anything else is skipped. Each number must fill its
 * cell (spaces aside), so `1e3` or `0.5junk` skips the row, which the upload
 * warns of, rather than drawing it at `1` or `0.5`; `start` and `end` are
 * safe whole numbers from 1. Sorted by start, then end.
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
 * Drops the rows on an accession that `lengths` (the drawn sequences' lengths;
 * legacy threw on the first) does not hold, and the rows that start past
 * their sequence's end, which would draw as a zero-width mark there. A row
 * that overlaps the end is kept and drawn clamped; its tooltip keeps the
 * uploaded coordinates. The scores are rescaled without the dropped rows, so
 * the plot range is the drawn one. `skipped` still counts only the unreadable
 * lines.
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
