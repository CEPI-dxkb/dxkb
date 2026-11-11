/**
 * The Genome Browser's URL state (`browser.loc`, `browser.tracks`, `browser.highlight`), written with `replaceState` so panning adds no history entries.
 * Defaults are omitted, except a cleared highlight is written as `browser.highlight=none` where the browser would otherwise open with one.
 */
import { replaceQuery } from "@/lib/url";
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

const noTracks = "none";
const noHighlight = "none";
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
  replaceQuery((params) => {
    applyGenomeBrowserUrlState(params, state);
  });
}

/** JBrowse 5 keeps highlights on the session; `view.highlights` is the read-only getter. `coarseVisibleLocStrings` holds one space-joined entry per visible sequence. */
export interface GenomeBrowserViewSource {
  coarseVisibleLocStrings: string;
  tracks: readonly { configuration: { trackId: string } }[];
  highlights: readonly { refName: string; start: number; end: number }[];
}

/** The URL carries only the first visible region and first highlight, since a multi-sequence location names no sequence on reload. With `hasDefaultHighlight`, a view without a highlight writes `null` so a cleared highlight stays cleared on remount. */
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
