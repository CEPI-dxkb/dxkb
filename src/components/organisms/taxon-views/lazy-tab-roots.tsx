"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The client root of every taxon and organism landing tab, each as its own
 * chunk. The landing shell renders only the active tab, but Turbopack puts every
 * Client Component the page's server module graph imports into the route's
 * chunk group, rendered or not, so static imports in the tab factories shipped
 * all ten collections, the Interactions shell, both phylogeny panels and the
 * taxonomy tree with every tab. The factories are Server Components, and
 * `next/dynamic` called from one does not code-split a Client Component, so the
 * dynamic imports live here (as in `lazy-compare-region-panel.tsx`). SSR stays
 * on: the active tab still renders on the server.
 *
 * A new taxon tab reaches its client root through here, by the root's own
 * module path (never the `@/components/views` barrel), and only `import type`
 * may name a target module: a value import would put it back in the route's
 * chunk group. `lazy-tab-roots-imports.test.ts` guards the factories.
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
