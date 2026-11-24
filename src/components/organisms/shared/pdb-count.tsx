import { Suspense, use } from "react";
import { failedCountDescription } from "@/components/organisms/shared/failed-count";
import { UnavailableCount } from "@/components/organisms/shared/unavailable-count";
import {
  StatTile,
  type StatTileProps,
} from "@/components/organisms/stat-tile/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import type { CountResult } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";

interface PdbStatTileProps extends Omit<StatTileProps, "value"> {
  pdb: Promise<CountResult>;
  /** The failure's reason, as the tile's Unavailable gives it. */
  formatReason: (reason: unknown) => string;
}

function SettledPdbStatTile({ pdb, formatReason, ...tile }: PdbStatTileProps) {
  const result = use(pdb);
  if (result.status === "fulfilled") {
    return <StatTile {...tile} value={numberFormatter.format(result.value)} />;
  }
  // Unlinked: the Unavailable button cannot sit inside the tile's link.
  const reason = formatReason(result.reason);
  return (
    <StatTile
      {...tile}
      href={undefined}
      description={failedCountDescription(tile.description, reason)}
      value={<UnavailableCount reason={reason} />}
    />
  );
}

/**
 * The PDB tile. The structure join takes about 23 s cold for large taxa, so
 * the tile has its own `Suspense` boundary: the other tiles render without
 * waiting for it, and this one holds a skeleton until the count settles. A
 * loaded count is a number in the linked tile; a failed one is never a number
 * but an `UnavailableCount` (with its reason, and a retry) in an unlinked
 * tile, so it needs a `CountRetryScope` around it.
 */
export function PdbStatTile({ pdb, formatReason, ...tile }: PdbStatTileProps) {
  return (
    <Suspense
      fallback={
        <StatTile
          {...tile}
          value={
            <>
              <Skeleton className="h-5.5 w-16" />
              <span className="sr-only">Loading</span>
            </>
          }
        />
      }
    >
      <SettledPdbStatTile {...tile} pdb={pdb} formatReason={formatReason} />
    </Suspense>
  );
}
