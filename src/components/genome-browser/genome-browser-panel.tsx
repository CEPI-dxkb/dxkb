"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import {
  genomeBrowserQueryKeys,
  loadGenomeBrowserRegions,
} from "@/lib/genome-browser/client";
import {
  genomeDefaultLocation,
  resolveInitialLocation,
  type GenomeBrowserFocus,
} from "@/lib/genome-browser/contract";
import { parseGenomeBrowserUrlState } from "@/lib/genome-browser/url-state";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { GenomeBrowserSkeleton } from "./genome-browser-skeleton";

// JBrowse (several MB) loads only here, in parallel with the regions request.
const GenomeBrowserView = dynamic(
  () =>
    import("./genome-browser-view").then((module) => module.GenomeBrowserView),
  { ssr: false, loading: () => <GenomeBrowserSkeleton /> },
);

export interface GenomeBrowserPanelProps {
  genomeId: string;
  /** Feature View: where to open, and what to highlight, when the URL names nothing. */
  focus?: GenomeBrowserFocus | null;
}

export function GenomeBrowserPanel({
  genomeId,
  focus,
}: GenomeBrowserPanelProps) {
  const urlState = parseGenomeBrowserUrlState(useTabContentSearchParams());
  const regions = useQuery({
    queryKey: genomeBrowserQueryKeys.regions(genomeId),
    queryFn: () => loadGenomeBrowserRegions(genomeId),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const loadRetry = useRetryKeepingError(regions, genomeId);

  if (loadRetry.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the Genome Browser</AlertTitle>
        <AlertDescription>
          <p>
            {formatUserFacingErrorMessage(
              loadRetry.error,
              "Failed to load this genome's sequences.",
            )}
          </p>
          <QueryRetryButton
            retrying={loadRetry.retrying}
            onRetry={loadRetry.retry}
          />
        </AlertDescription>
      </Alert>
    );
  }
  if (regions.data?.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No sequences are available for this genome.
      </p>
    );
  }
  // The URL is hand-editable and may come from another genome, and a feature's
  // accession may not be among its genome's sequences: a location or highlight
  // JBrowse cannot read would break the browser, so each falls back, the URL to
  // the feature's focus and the focus to the genome's default.
  const location = regions.data
    ? resolveInitialLocation(
        urlState.location,
        regions.data,
        resolveInitialLocation(
          focus?.location,
          regions.data,
          genomeDefaultLocation(regions.data),
        ),
      )
    : undefined;
  // The focus's highlight is the default; `browser.highlight=none` (a cleared
  // highlight, parsed as `null`) opts out of it, so a remount (a theme switch,
  // a return to the tab) does not bring the highlight back.
  const defaultHighlight = regions.data
    ? resolveInitialLocation(focus?.highlight, regions.data, undefined)
    : undefined;
  const highlight =
    regions.data && urlState.highlight !== null
      ? resolveInitialLocation(
          urlState.highlight,
          regions.data,
          defaultHighlight,
        )
      : undefined;
  return (
    <GenomeBrowserView
      genomeId={genomeId}
      location={location}
      highlight={highlight}
      hasDefaultHighlight={defaultHighlight !== undefined}
      tracks={urlState.tracks}
    />
  );
}
