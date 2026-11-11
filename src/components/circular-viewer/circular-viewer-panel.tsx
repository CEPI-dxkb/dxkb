"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { circularViewerQueryKeys, loadContigs } from "@/lib/circular-viewer/client";
import { maxContigs } from "@/lib/circular-viewer/contract";
import { buildGenomeLayout } from "@/lib/circular-viewer/layout";
import { initialTrackState, trackReducer } from "@/lib/circular-viewer/track-state";
import { exportSvgFigure } from "@/lib/svg-figure-export";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { CircularViewerFigure } from "./circular-viewer-figure";
import { CircularViewerTrackList } from "./circular-viewer-track-list";
import { CustomTrackForm } from "./custom-track-form";
import { UserTrackForm } from "./user-track-form";
import { useCircularTrackData } from "./use-circular-track-data";

const guideUrl = "https://www.bv-brc.org/docs/quick_references/organisms_genome/circular_genome_viewer.html";

export interface CircularViewerPanelProps {
  genomeId: string;
}

export function CircularViewerPanel({ genomeId }: CircularViewerPanelProps) {
  const contigs = useQuery({
    queryKey: circularViewerQueryKeys.contigs(genomeId),
    queryFn: ({ signal }) => loadContigs(genomeId, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const loadRetry = useRetryKeepingError(contigs, genomeId);
  const [state, dispatch] = useReducer(trackReducer, undefined, initialTrackState);
  const sequences = contigs.data?.contigs;
  const tracks = useCircularTrackData(genomeId, state.tracks, sequences);
  const layout = useMemo(() => buildGenomeLayout(sequences ?? []), [sequences]);
  const sequenceLengths = useMemo(
    () => (sequences ? new Map(sequences.map((contig) => [contig.accession, contig.length])) : undefined),
    [sequences],
  );
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  // A loading ring would be exported mid-pulse, so Export waits for every shown track.
  const settled = state.tracks.every(
    (track) => !track.visible || tracks.data.get(track.id)?.status !== "pending",
  );

  const toastedEmpty = useRef(new Set<string>());
  useEffect(() => {
    for (const track of state.tracks) {
      if (track.source.kind !== "custom" || toastedEmpty.current.has(track.id)) continue;
      const answer = tracks.data.get(track.id);
      if (answer?.status === "ready" && answer.items.kind === "features" && answer.items.features.length === 0) {
        toastedEmpty.current.add(track.id);
        toast.error("No data found.");
      }
    }
  }, [state.tracks, tracks.data]);

  if (loadRetry.error) {
    return (
      <Alert variant="destructive" className="m-3">
        <AlertTitle>Could not load the Circular Viewer</AlertTitle>
        <AlertDescription>
          <p>{formatUserFacingErrorMessage(loadRetry.error, "Failed to load this genome's sequences.")}</p>
          <QueryRetryButton retrying={loadRetry.retrying} onRetry={loadRetry.retry} />
        </AlertDescription>
      </Alert>
    );
  }
  if (contigs.data === undefined) return <Skeleton className="m-3 h-96" />;
  if (contigs.data.contigs.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">No sequences are available for this genome.</p>;
  }

  return (
    // `flex-1`, not `h-full`: in the tab's fill region a percentage height can
    // resolve to 0, and the figure draws nothing at a zero-sized parent. Both
    // scrollers are `relative`: otherwise an absolutely positioned descendant
    // (the guide link's `sr-only` cue) escapes the scroller's clip and
    // stretches the page.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-3 pr-2 sm:pr-3 lg:pr-4">
      <div
        data-testid="circular-viewer"
        className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-t-xl border border-b-0 bg-card text-card-foreground shadow-sm max-md:overflow-y-auto md:flex-row"
      >
        <aside className="relative flex flex-col divide-y border-b p-3 *:py-3 *:first:pt-0 *:last:pb-0 md:w-80 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
          <CircularViewerTrackList
            tracks={state.tracks}
            data={tracks.data}
            gcWindowSize={tracks.gcWindowSize}
            dispatch={dispatch}
            errors={tracks.errors}
          />
          <CustomTrackForm
            onAdd={(query, name) => {
              dispatch({ type: "addCustom", query, name });
            }}
          />
          <UserTrackForm
            sequenceLengths={sequenceLengths}
            onAdd={(plot, parsed, fileName, name) => {
              dispatch({ type: "addUser", plot, parsed, fileName, name });
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={svg === null || !settled}
              onClick={() => {
                if (svg) exportSvgFigure(svg, `circular-genome-${genomeId}.svg`);
              }}
            >
              <Download />
              Export SVG
            </Button>
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <BookOpen />
              User guide{" "}
              <span className="sr-only">(opens in a new tab)</span>
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </aside>
        <div
          data-testid="circular-viewer-figure-area"
          className="relative min-w-0 max-md:aspect-square max-md:shrink-0 md:flex-1"
        >
          {contigs.data.truncated && (
            <p className="absolute top-2 left-3 z-10 text-2xs text-warning">
              Showing the first {maxContigs.toLocaleString("en-US")} sequences of this genome.
            </p>
          )}
          <CircularViewerFigure
            genomeId={genomeId}
            layout={layout}
            tracks={state.tracks}
            data={tracks.data}
            svgRef={setSvg}
          />
        </div>
      </div>
    </div>
  );
}
