/**
 * The Genome Browser's URL state: `browser.loc`, `browser.tracks` and
 * `browser.highlight`. The `browser.` prefix is a `childCollectionUrlKeys`
 * entry, so switching tabs clears it like any tab-owned param. Written with
 * `replaceState` from JBrowse's `observeSession` read-back: panning must not
 * add a history entry per move. Defaults (all three tracks, no highlight) are
 * omitted, except that a cleared highlight is written as `browser.highlight=none`
 * where the browser would otherwise open with one (the Feature View's focus).
 * JBrowse-free, so the panel and its tests never load JBrowse.
 */
import { toQueryString } from "@/lib/url";
import {
  formatLocation,
  genomeBrowserTrackIds,
  isGenomeBrowserTrackId,
  type GenomeBrowserTrackId,
} from "./contract";

const genomeBrowserUrlParams = {
  location: "browser.loc",
  tracks: "browser.tracks",
  highlight: "browser.highlight",
} as const;

/** `browser.tracks=none`: the user hid every track. */
const noTracks = "none";
/** `browser.highlight=none`: the user cleared the highlight. */
const noHighlight = "none";
/** Longest location or highlight the URL carries, read side and write side. */
const maxLocationLength = 300;

export interface GenomeBrowserUrlState {
  location?: string;
  tracks: readonly GenomeBrowserTrackId[];
  /** `null`: the user cleared it, so no default highlight applies either. */
  highlight?: string | null;
}

function bounded(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= maxLocationLength ? trimmed : undefined;
}

function parseTracks(value: string | null): readonly GenomeBrowserTrackId[] {
  if (value === noTracks) return [];
  const tracks = [
    ...new Set((value ?? "").split(",").map((item) => item.trim())),
  ].filter(isGenomeBrowserTrackId);
  return tracks.length > 0 ? tracks : genomeBrowserTrackIds;
}

export function parseGenomeBrowserUrlState(
  params: Pick<URLSearchParams, "get">,
): GenomeBrowserUrlState {
  const location = bounded(params.get(genomeBrowserUrlParams.location));
  const rawHighlight = params.get(genomeBrowserUrlParams.highlight);
  const highlight =
    rawHighlight?.trim() === noHighlight ? null : bounded(rawHighlight);
  return {
    ...(location ? { location } : {}),
    tracks: parseTracks(params.get(genomeBrowserUrlParams.tracks)),
    ...(highlight !== undefined ? { highlight } : {}),
  };
}

function isDefaultTracks(tracks: readonly GenomeBrowserTrackId[]): boolean {
  return (
    tracks.length === genomeBrowserTrackIds.length &&
    genomeBrowserTrackIds.every((track) => tracks.includes(track))
  );
}

function serializeTracks(
  tracks: readonly GenomeBrowserTrackId[],
): string | undefined {
  if (isDefaultTracks(tracks)) return undefined;
  if (tracks.length === 0) return noTracks;
  return tracks.join(",");
}

export function applyGenomeBrowserUrlState(
  params: URLSearchParams,
  state: GenomeBrowserUrlState,
): void {
  const set = (name: string, value: string | undefined) => {
    if (value === undefined) params.delete(name);
    else params.set(name, value);
  };
  set(genomeBrowserUrlParams.location, state.location);
  set(genomeBrowserUrlParams.tracks, serializeTracks(state.tracks));
  set(
    genomeBrowserUrlParams.highlight,
    state.highlight === null ? noHighlight : state.highlight,
  );
}

export function writeGenomeBrowserUrlState(state: GenomeBrowserUrlState): void {
  const { pathname, search, hash } = window.location;
  // A separate URLSearchParams: mutating url.searchParams re-escapes the query.
  const params = new URLSearchParams(search);
  applyGenomeBrowserUrlState(params, state);
  const query = toQueryString(params);
  const next = `${pathname}${query ? `?${query}` : ""}${hash}`;
  if (next !== `${pathname}${search}${hash}`) {
    window.history.replaceState(null, "", next);
  }
}

/**
 * The parts of JBrowse 5's `LinearGenomeView` model the URL mirrors. JBrowse 5
 * keeps highlights on the session; `view.highlights` is the read-only getter
 * for the ones on this view's assemblies. `coarseVisibleLocStrings` joins one
 * entry per visible sequence with spaces, so a view over a contig boundary (or
 * zoomed out over many contigs) holds several.
 */
export interface GenomeBrowserViewSource {
  coarseVisibleLocStrings: string;
  tracks: readonly { configuration: { trackId: string } }[];
  highlights: readonly { refName: string; start: number; end: number }[];
}

/**
 * The URL carries the view's first visible region only, and likewise the
 * first highlight: a location that spans two sequences
 * (`ctg1:9000..10000 ctg2:1..500`) names no sequence on reload, and a
 * zoomed-out view of a many-contig genome would write one entry per contig on
 * every pan. A reopened link opens on that first region. A region or highlight
 * longer than the read side accepts is not written. With `hasDefaultHighlight`
 * (the browser opens on a highlighted feature when the URL names none), a view
 * without a highlight writes `null`, so the cleared highlight stays cleared on
 * a remount instead of falling back to the default.
 */
export function viewUrlState(
  view: GenomeBrowserViewSource,
  { hasDefaultHighlight = false }: { hasDefaultHighlight?: boolean } = {},
): GenomeBrowserUrlState | null {
  const firstRegion = view.coarseVisibleLocStrings.trim().split(/\s+/).at(0);
  if (!firstRegion) return null;
  const location = bounded(
    // JBrowse groups digits ("6,610"); the URL reads cleaner without.
    firstRegion.replace(/(\d),(?=\d{3}\b)/g, "$1"),
  );
  const firstHighlight = view.highlights.at(0);
  const highlight = firstHighlight
    ? bounded(
        formatLocation(
          firstHighlight.refName,
          firstHighlight.start + 1,
          firstHighlight.end,
        ),
      )
    : undefined;
  return {
    ...(location ? { location } : {}),
    tracks: view.tracks
      .map((track) => track.configuration.trackId)
      .filter(isGenomeBrowserTrackId),
    ...(highlight
      ? { highlight }
      : !firstHighlight && hasDefaultHighlight
        ? { highlight: null }
        : {}),
  };
}
