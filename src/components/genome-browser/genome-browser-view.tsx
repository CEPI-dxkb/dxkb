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
  /** Undefined until the panel knows the genome's sequences. */
  location?: string;
  highlight?: string;
  /**
   * Whether the browser opens highlighted when the URL names no highlight
   * (the Feature View's focus). A cleared highlight is then written as
   * `browser.highlight=none`, so it is not restored on a remount.
   */
  hasDefaultHighlight?: boolean;
  tracks: readonly GenomeBrowserTrackId[];
}

/**
 * The lazily loaded half of the Genome Browser: everything that imports
 * JBrowse. A theme switch remounts the browser (its palette and track colors
 * come from theme tokens read when the engine is built), which reopens it at
 * the location the URL holds by then; the unmount destroys the old engine and
 * evicts its adapters (see `GenomeBrowserInstance`). The remount follows the
 * theme attribute on `<html>`, not `useTheme()`: next-themes writes the
 * attribute from its own passive effect, which runs after the one that builds
 * the engine in a child mounted by the same commit, so keying on
 * `resolvedTheme` would read the previous theme's tokens (the same ordering
 * `sigma-canvas.tsx` observes the attribute for). A different genome rebuilds
 * too, since the builder reads `genomeId` once.
 */
export function GenomeBrowserView(props: GenomeBrowserViewProps) {
  const appliedTheme = useAppliedTheme();
  if (props.location === undefined) return <GenomeBrowserSkeleton />;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col p-2"
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
  // Built once per mount (JBrowse 5 reads the builder on the first render
  // only), so the URL this component writes never rebuilds the browser; React
  // owns the engine and destroys it on unmount.
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
      // Bounded by the tab's fill region instead of growing with its tracks.
      // "100%" only holds with the `[data-slot="genome-browser"]` rule in
      // globals.css (spike item 2: MUI's ScopedCssBaseline wrapper has no
      // height of its own, so without the rule the view spills its box).
      height: "100%",
    });
    // Light or dark for JBrowse's own chrome; the palette is the config's.
    state.session.setThemeMode(mode);
    return state;
  });

  // Whether the view has shown a track yet, or was asked to show none. JBrowse
  // reports a location before any track has attached, when `view.tracks` is
  // still empty, and writing that would put `browser.tracks=none` in the URL
  // until the tracks arrive. Once a track has been seen, an empty list is the
  // user's own choice and is written. Read once, from the tracks the view was
  // built with.
  const tracksShown = useRef(tracks.length === 0);

  // Fires several times while the view loads (first before it has a region,
  // which `viewUrlState` skips; then as each track attaches, which
  // `writeGenomeBrowserUrlState` skips as unchanged) and once per pan or zoom
  // after that (spike item 4). Values read here are tracked by JBrowse's
  // autorun, so a highlight change also rewrites the URL. The URL always
  // shows what is on screen, as legacy's hash did.
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

  // Works around a JBrowse 5.0.0-beta.17 teardown bug. `destroyViewState`
  // destroys the RPC manager before the view tree, so each track's disposer
  // (`releaseAdapterSession` -> `rpcManager.freeSession`) finds the manager
  // destroyed and frees nothing. With main-thread RPC the adapters then stay in
  // `dataAdapterCache`'s module-level Map, each holding its dead engine's
  // PluginManager (about 2 MiB per genome opened in a page session), and a
  // later engine for the same genome would reuse the dead engine's adapter
  // (the cache key is the adapter config). This app hosts one engine at a
  // time, so its final unmount evicts every cached adapter; an engine being
  // built at that moment (a theme or genome remount) at worst builds one
  // again. StrictMode-safe: `useFinalUnmount` skips the dev double mount.
  // Recheck on every beta bump; drop it once JBrowse frees the sessions first.
  //
  // The other 5.0.0-beta.17 workaround lives outside this file, in
  // `patches/@jbrowse__product-core@5.0.0-beta.17.patch`. Editing the
  // Reference Sequence track's settings (Show... > Translation) ends in
  // `Tracks.updateTrackConfiguration`, because that track lives in the
  // assembly and has no `tracks` entry to hold the edit, and it calls
  // `self.jbrowse.updateTrackConf`, which only the full JBrowse app's root
  // config defines; the embedded one has none, so the edit threw a TypeError
  // 400 ms later. The patch makes the call optional (the edit is already on the
  // track). pnpm fails the install when the patched version is gone, so a bump
  // forces the recheck; drop the patch once embedded JBrowse defines it.
  useFinalUnmount(() => {
    void keepAdapters(() => false);
  });

  if (!viewState) return <GenomeBrowserSkeleton />;
  return <JBrowseLinearGenomeView viewState={viewState} />;
}
