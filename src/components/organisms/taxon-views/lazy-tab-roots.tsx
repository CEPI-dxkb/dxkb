"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The client root of every taxon and organism landing tab, each as its own chunk.
 * Turbopack puts every Client Component a server module imports into the route's
 * chunk group, rendered or not, and `next/dynamic` called from a Server Component
 * does not code-split one, so the dynamic imports live here.
 *
 * A new tab reaches its root through here by the root's own module path (never the
 * `@/components/views` barrel); only `import type` may name a target module.
 * `lazy-tab-roots-imports.test.ts` guards the factories.
 */

/** The fill-layout frame every tab fallback shares. */
function LoadingFrame({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-label="Loading tab"
      className="flex min-h-0 flex-1 flex-col gap-2"
    >
      {children}
    </div>
  );
}

function TabLoading() {
  return (
    <LoadingFrame>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="min-h-96 w-full flex-1" />
    </LoadingFrame>
  );
}

function PhylogenyLoading() {
  return (
    <LoadingFrame>
      <Skeleton className="size-full flex-1" />
    </LoadingFrame>
  );
}

export const LazyGenomeResourceCollection = dynamic(
  () =>
    import("@/components/views/genome-resource-collection").then(
      (module) => module.GenomeResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyFeatureResourceCollection = dynamic(
  () =>
    import("@/components/views/feature-resource-collection").then(
      (module) => module.FeatureResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyStrainResourceCollection = dynamic(
  () =>
    import("@/components/views/strain-resource-collection").then(
      (module) => module.StrainResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyEpitopeResourceCollection = dynamic(
  () =>
    import("@/components/views/epitope-resource-collection").then(
      (module) => module.EpitopeResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyExperimentResourceCollection = dynamic(
  () =>
    import("@/components/views/experiment-resource-collection").then(
      (module) => module.ExperimentResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazySerologyResourceCollection = dynamic(
  () =>
    import("@/components/views/serology-resource-collection").then(
      (module) => module.SerologyResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazySurveillanceResourceCollection = dynamic(
  () =>
    import("@/components/views/surveillance-resource-collection").then(
      (module) => module.SurveillanceResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyProteinStructureResourceCollection = dynamic(
  () =>
    import("@/components/views/protein-structure-resource-collection").then(
      (module) => module.ProteinStructureResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyProteinFeatureResourceCollection = dynamic(
  () =>
    import("@/components/views/protein-feature-resource-collection").then(
      (module) => module.ProteinFeatureResourceCollection,
    ),
  { loading: TabLoading },
);

export const LazyResourceChildCollection = dynamic(
  () =>
    import("@/components/views/resource-child-collection").then(
      (module) => module.ResourceChildCollection,
    ),
  { loading: TabLoading },
);

export const LazyInteractionsSubviewShell = dynamic(
  () =>
    import("@/components/interactions/interactions-subview-shell").then(
      (module) => module.InteractionsSubviewShell,
    ),
  { loading: TabLoading },
);

export const LazyBacterialPhylogenyPanel = dynamic(
  () =>
    import("@/components/phylogeny/bacterial-phylogeny-panel").then(
      (module) => module.BacterialPhylogenyPanel,
    ),
  { loading: PhylogenyLoading },
);

export const LazyViralPhylogenyPanel = dynamic(
  () =>
    import("@/components/phylogeny/viral-phylogeny-panel").then(
      (module) => module.ViralPhylogenyPanel,
    ),
  { loading: PhylogenyLoading },
);

export const LazyTaxonomyTreePanel = dynamic(
  () =>
    import("@/components/taxonomy/taxonomy-tree-panel").then(
      (module) => module.TaxonomyTreePanel,
    ),
  { loading: TabLoading },
);
