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

const GenomeBrowserView = dynamic(
  () =>
    import("./genome-browser-view").then((module) => module.GenomeBrowserView),
  { ssr: false, loading: () => <GenomeBrowserSkeleton /> },
);

export interface GenomeBrowserPanelProps {
  genomeId: string;
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
  // The URL is hand-editable, so a location or highlight JBrowse cannot read
  // falls back to the feature's focus, then the genome's default.
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
  // `browser.highlight=none` (parsed as `null`) opts out of the focus's
  // highlight so a remount does not bring it back.
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
