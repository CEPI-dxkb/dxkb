import { Suspense, use } from "react";
import { SectionRetryButton } from "@/components/organisms/shared/section-retry-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CountResult } from "@/lib/services/organisms/types";
import { numberFormatter } from "@/lib/services/organisms/utils";

/** What the PDB tile shows for a count whose load failed. */
export const unavailableCount = "Unavailable";

function PdbValue({ pdb }: { pdb: Promise<CountResult> }) {
  const result = use(pdb);
  return result.status === "fulfilled"
    ? numberFormatter.format(result.value)
    : unavailableCount;
}

/**
 * The PDB tile's figure. The structure join takes about 23 s cold for large
 * taxa, so the tile has its own `Suspense` boundary: the other tiles render
 * without waiting for it, and this one holds a skeleton until the count
 * settles. A failed count reads as Unavailable, never as a number; the reason
 * is `PdbCountAlert`'s.
 */
export function PdbCountValue({ pdb }: { pdb: Promise<CountResult> }) {
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="h-5.5 w-16" />
          <span className="sr-only">Loading</span>
        </>
      }
    >
      <PdbValue pdb={pdb} />
    </Suspense>
  );
}

function PdbAlert({
  pdb,
  lead,
  formatReason,
}: {
  pdb: Promise<CountResult>;
  lead: string;
  formatReason: (reason: unknown) => string;
}) {
  const result = use(pdb);
  if (result.status === "fulfilled") return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 text-xs text-destructive"
    >
      <p>
        {lead}: {formatReason(result.reason)}
      </p>
      <SectionRetryButton />
    </div>
  );
}

/**
 * The reason a PDB count failed, with a Retry, in the PDB tile's own boundary
 * (nothing renders while the count is pending or when it loaded).
 */
export function PdbCountAlert(props: {
  pdb: Promise<CountResult>;
  /** What the alert says could not be loaded, before the reason. */
  lead: string;
  formatReason: (reason: unknown) => string;
}) {
  return (
    <Suspense fallback={null}>
      <PdbAlert {...props} />
    </Suspense>
  );
}
