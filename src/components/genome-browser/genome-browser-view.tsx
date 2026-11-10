"use client";

import { keepAdapters } from "@jbrowse/core/data_adapters/dataAdapterCache";
import { useFinalUnmount } from "@jbrowse/core/util/hooks";
import { observeSession } from "@jbrowse/product-core";
import {
  createViewStateAsync,
  JBrowseLinearGenomeView,
  useCreateViewState,
} from "@jbrowse/react-linear-genome-view2";
import { useEffect, useRef } from "react";
import type { GenomeBrowserTrackId } from "@/lib/genome-browser/contract";
import {
  viewUrlState,
  writeGenomeBrowserUrlState,
} from "@/lib/genome-browser/url-state";
import { parseTheme, type ThemeMode } from "@/styles/themes";
import { GenomeBrowserErrorBoundary } from "./genome-browser-error-boundary";
import { GenomeBrowserSkeleton } from "./genome-browser-skeleton";
import {
  buildGenomeBrowserConfig,
  buildGenomeBrowserView,
} from "./jbrowse/config";
import { BvbrcGenomeBrowserPlugin } from "./jbrowse/plugin";
import {
  buildJBrowseTheme,
  readThemeColors,
  trackColorsFrom,
} from "./jbrowse/theme";
import { useAppliedTheme } from "./use-applied-theme";

export interface GenomeBrowserViewProps {
  genomeId: string;
  location?: string;
  highlight?: string;
  hasDefaultHighlight?: boolean;
  tracks: readonly GenomeBrowserTrackId[];
}

/**
 * The remount on theme change follows the theme attribute on `<html>`, not
 * `useTheme()`: next-themes writes it from a passive effect that runs after the
 * engine-building one, so `resolvedTheme` would read the previous tokens.
 */
export function GenomeBrowserView(props: GenomeBrowserViewProps) {
  const appliedTheme = useAppliedTheme();
  if (props.location === undefined) return <GenomeBrowserSkeleton />;
  // `isolate` keeps JBrowse's z-indexes (MUI sticky headers at 825-850) from
  // drawing over the app's z-50 portalled popups.
  return (
    <div
      className="isolate flex min-h-0 flex-1 flex-col p-2"
      data-slot="genome-browser"
      data-testid="genome-browser"
    >
      <GenomeBrowserErrorBoundary
        key={`${props.genomeId}|${appliedTheme ?? "default"}`}
      >
        <GenomeBrowserInstance
          {...props}
          location={props.location}
          mode={parseTheme(appliedTheme).mode}
        />
      </GenomeBrowserErrorBoundary>
    </div>
  );
}

function GenomeBrowserInstance({
  genomeId,
  location,
  highlight,
  hasDefaultHighlight = false,
  tracks,
  mode,
}: GenomeBrowserViewProps & { location: string; mode: ThemeMode }) {
  // JBrowse 5 reads the builder on the first render only, so the URL this
  // component writes never rebuilds the browser.
  const viewState = useCreateViewState(async () => {
    const colors = readThemeColors();
    const state = await createViewStateAsync({
      ...buildGenomeBrowserConfig({
        genomeId,
        trackColors: trackColorsFrom(colors),
        theme: buildJBrowseTheme(
          colors,
          mode,
          getComputedStyle(document.body).fontFamily,
        ),
      }),
      plugins: [BvbrcGenomeBrowserPlugin],
      view: buildGenomeBrowserView({ location, tracks, highlight }),
      disableAddTracks: true,
      // "100%" only holds with the `[data-slot="genome-browser"]` rule in
      // globals.css: MUI's ScopedCssBaseline wrapper has no height of its own.
      height: "100%",
    });
    state.session.setThemeMode(mode);
    return state;
  });

  // JBrowse reports a location before any track attaches, and writing that
  // would put `browser.tracks=none` in the URL; only an empty list after a
  // track was seen is the user's choice.
  const tracksShown = useRef(tracks.length === 0);

  useEffect(() => {
    if (!viewState) return;
    return observeSession(viewState, {
      onLocationChange: () => {
        const next = viewUrlState(viewState.session.view, {
          hasDefaultHighlight,
        });
        if (!next) return;
        if (next.tracks.length > 0) tracksShown.current = true;
        if (!tracksShown.current) return;
        writeGenomeBrowserUrlState(next);
      },
    });
  }, [viewState, hasDefaultHighlight]);

  // Works around a JBrowse 5.0.0-beta.20 teardown bug: `destroyViewState`
  // destroys the RPC manager first, so adapters stay in `dataAdapterCache`
  // holding their dead engine; recheck on every beta bump.
  // The other workaround is
  // `patches/@jbrowse__product-core@5.0.0-beta.20.patch`.
  useFinalUnmount(() => {
    void keepAdapters(() => false);
  });

  if (!viewState) return <GenomeBrowserSkeleton />;
  return <JBrowseLinearGenomeView viewState={viewState} />;
}
