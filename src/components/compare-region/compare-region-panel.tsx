"use client";

/**
 * The Feature View's Compare Region tab: the command bar and the figure in
 * one card. It runs the comparison the URL's settings name, shows its status
 * (loading, failed with a Retry, a group that needs a session, nothing found)
 * in place of the figure, and keeps the figure's density as a device
 * preference.
 */
import { useQuery } from "@tanstack/react-query";
import { useParentSize } from "@visx/responsive";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useAuth } from "@/lib/auth/provider";
import {
  compareRegionQueryKeys,
  isCompareRegionSignInError,
  loadCompareRegion,
} from "@/lib/compare-region/client";
import {
  compareRegionFilterLabels,
  type CompareRegionRow,
  type CompareRegionSettings,
} from "@/lib/compare-region/contract";
import type { CompareRegionDensity } from "@/lib/compare-region/density-options";
import {
  parseCompareRegionUrlState,
  writeCompareRegionUrlState,
} from "@/lib/compare-region/url-state";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { CompareRegionChart } from "./compare-region-chart";
import { CommandBar } from "./compare-region-command-bar";
import { exportCompareRegionFigure } from "./compare-region-export";
import type { ZoomControls } from "./compare-region-zoom-controls";
import { useCompareRegionSettings } from "./use-compare-region-settings";

/** What a signed-out group comparison can do instead: sign in, or compare public genomes. */
const signInHint = `Sign in, or choose "${compareRegionFilterLabels.reference}" or "${compareRegionFilterLabels.all}" under Genomes.`;

interface CompareRegionBodyProps {
  applied: CompareRegionSettings;
  /** A request is in flight. */
  busy: boolean;
  signedIn: boolean;
  /** Shown under the bar in place of the figure (loading, failed, nothing found); null with rows to draw. */
  status: ReactNode;
  rows: readonly CompareRegionRow[] | undefined;
  /** The card's width, px; 0 until it is measured. */
  width: number;
  density: CompareRegionDensity;
  onDensityChange: (density: CompareRegionDensity) => void;
  onExport: (svg: SVGSVGElement) => void;
}

/**
 * The card's content for one query: the command bar over its settings draft,
 * then the status or the figure. The panel keys it by the query identity, so
 * a new query (Update, back/forward) starts a fresh draft from the settings
 * it applied, and a new answer starts unzoomed and unselected. The draft
 * lives here, not in the bar, because the bar moves from beside the status
 * into the figure (which hands it the zoom) when the answer arrives, as after
 * a Retry.
 */
function CompareRegionBody({
  applied,
  busy,
  signedIn,
  status,
  rows,
  width,
  density,
  onDensityChange,
  onExport,
}: CompareRegionBodyProps) {
  const settings = useCompareRegionSettings(
    applied,
    writeCompareRegionUrlState,
  );
  const renderBar = (
    zoom: ZoomControls | null,
    exportChart: (() => void) | null,
  ) => (
    <CommandBar
      settings={settings}
      busy={busy}
      signedIn={signedIn}
      zoom={zoom}
      onExport={exportChart}
    />
  );
  if (status || !rows) {
    return (
      <>
        {renderBar(null, null)}
        <div className="min-h-0 overflow-auto p-3">{status}</div>
      </>
    );
  }
  if (width === 0) return renderBar(null, null);
  return (
    <CompareRegionChart
      rows={rows}
      width={width}
      settings={applied}
      density={density}
      onDensityChange={onDensityChange}
      renderBar={renderBar}
      onExport={onExport}
    />
  );
}

export interface CompareRegionPanelProps {
  /** The focus gene's BRC ID (`patric_id`, `fig|…`). */
  patricId: string;
}

export function CompareRegionPanel({ patricId }: CompareRegionPanelProps) {
  const searchParams = useTabContentSearchParams();
  const applied = parseCompareRegionUrlState(searchParams);
  const query = { peg: patricId, ...applied };
  // One string per request: it keys the card's content (the settings draft
  // and the chart, so a new answer starts unzoomed and unselected) and the
  // retry's identity.
  const queryIdentity = JSON.stringify(query);
  const result = useQuery({
    queryKey: compareRegionQueryKeys.rows(query),
    // No `signal`: TanStack aborts a query that read it when its last
    // observer unmounts (a tab switch), while the service call it started
    // keeps running on the server. Returning would then queue a second
    // request behind it; without the signal it re-joins the one in flight.
    queryFn: () => loadCompareRegion(query),
    // A request takes seconds to a minute and the service takes one at a
    // time: keep answers for the visit, and let the user retry rather than
    // retrying for them.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const loadRetry = useRetryKeepingError(result, queryIdentity);
  const { isAuthenticated } = useAuth();
  const [density, setDensity] = useUiPreference("compareRegionDensity");
  const { parentRef, width } = useParentSize<HTMLElement>({ debounceTime: 50 });
  const rows = result.data;

  let status: ReactNode = null;
  if (isCompareRegionSignInError(loadRetry.error)) {
    // A group filter without a session: retrying would answer 401 again.
    status = (
      <Alert variant="destructive">
        <AlertTitle>Could not compare regions</AlertTitle>
        <AlertDescription>
          <p>
            {formatUserFacingErrorMessage(
              loadRetry.error,
              "Sign in to compare against a workspace group.",
            )}
          </p>
          <p>{signInHint}</p>
        </AlertDescription>
      </Alert>
    );
  } else if (loadRetry.error) {
    status = (
      <Alert variant="destructive">
        <AlertTitle>Could not compare regions</AlertTitle>
        <AlertDescription>
          <p>
            {formatUserFacingErrorMessage(
              loadRetry.error,
              "The compare region service did not answer.",
            )}
          </p>
          <QueryRetryButton
            retrying={loadRetry.retrying}
            onRetry={loadRetry.retry}
          />
        </AlertDescription>
      </Alert>
    );
  } else if (!rows) {
    status = (
      <div className="space-y-2" role="status">
        <p className="text-sm text-muted-foreground">
          {`Comparing regions across ${String(applied.genomes)} genomes. This takes from a few seconds to over a minute.`}
        </p>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  } else if (rows.length === 0) {
    status = (
      <p className="text-sm text-muted-foreground">
        No comparable regions were found for this gene.
      </p>
    );
  }

  return (
    // The tab fills the view shell's region, which runs under the page's right
    // padding (`-mr-*`) and does not scroll: the padding gives the card back
    // that inset, and the card scrolls the figure itself. The card fills the
    // region down to the page's bottom edge, as the data tables do, so it has
    // no padding under it and no bottom border or corners. `min-w-0`: the
    // figure's floor must not widen the card (and so its measured width).
    <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-3 pr-2 sm:pr-3 lg:pr-4">
      <section
        ref={parentRef}
        aria-label="Compare regions"
        className="flex min-h-0 min-w-0 flex-1 flex-col rounded-t-xl border border-b-0 bg-card text-card-foreground shadow-sm"
      >
        <CompareRegionBody
          key={queryIdentity}
          applied={applied}
          busy={result.isFetching}
          signedIn={isAuthenticated}
          status={status}
          rows={rows}
          width={width}
          density={density}
          onDensityChange={setDensity}
          onExport={(svg) => {
            exportCompareRegionFigure(
              svg,
              `compare-regions-${patricId.replace(/[^\w.-]+/g, "_")}.svg`,
            );
          }}
        />
      </section>
    </div>
  );
}
