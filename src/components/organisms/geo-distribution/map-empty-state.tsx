import { Info, TriangleAlert } from "lucide-react";

import { SectionRetryButton } from "@/components/organisms/shared/section-retry-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import type { GeoMapState } from "./types";

export interface MapEmptyMessage {
  title: string;
  description: string | null;
  /** The county query failed: drawn as a destructive alert with Retry, not as a neutral notice. */
  failed?: boolean;
}

const countFormatter = new Intl.NumberFormat("en-US");

/** What to tell the user about a view whose regions have no genomes. */
export function describeEmptyView(
  mapState: GeoMapState,
  data: OrganismGeoDistribution,
): MapEmptyMessage {
  if (mapState.view === "world") {
    return { title: "No country-level data for this taxon.", description: null };
  }
  if (mapState.view === "us") {
    return { title: "No US state-level data for this taxon.", description: null };
  }
  const name = mapState.selectedStateName ?? "this state";
  const genomes = data.stateData[name] ?? 0;
  if (genomes === 0) {
    return {
      title: `No data for ${name}.`,
      description: `No genome count is available for ${name}.`,
    };
  }
  if (data.countyError) {
    return {
      title: "County data could not be loaded.",
      description: data.countyError,
      failed: true,
    };
  }
  return {
    title: "No county-level data for this taxon.",
    description: `${name} has ${countFormatter.format(genomes)} ${genomes === 1 ? "genome" : "genomes"}, but county-level data is unavailable.`,
  };
}

/**
 * A card over the map saying why it is blank. The wrapper stays mounted so a
 * screen reader announces the message when it appears, and it lets pointer
 * events through so the map can still be panned, zoomed and hovered. A failed
 * county query is a destructive alert with the upstream message and a Retry
 * that refreshes the route; it stays inside the one live region instead of
 * adding a nested `role="alert"` that would announce it twice.
 */
export function MapEmptyState({ message }: { message: MapEmptyMessage | null }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex items-center justify-center p-4"
    >
      {message && !message.failed && (
        <Alert variant="notice" role={undefined} className="w-auto max-w-sm">
          <Info aria-hidden="true" />
          <AlertTitle>{message.title}</AlertTitle>
          {message.description && (
            <AlertDescription>{message.description}</AlertDescription>
          )}
        </Alert>
      )}
      {message?.failed && (
        // The wrapper above lets the pointer through to the map; Retry needs it back.
        <div className="pointer-events-auto">
          <Alert variant="destructive" role={undefined} className="w-auto max-w-sm">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{message.title}</AlertTitle>
            <AlertDescription>
              {message.description && <p>{message.description}</p>}
              <SectionRetryButton />
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
