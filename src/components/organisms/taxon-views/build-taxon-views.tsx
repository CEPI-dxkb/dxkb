import type { ComponentType } from "react";

import type {
  OrganismLandingConfig,
  OrganismLandingView,
} from "@/components/organisms/types";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { getCuratedLists } from "@/lib/taxon-view/curated-lists";
import { hasBacterialOrViralPhylogeny } from "@/lib/taxon-view/predicates";
import { buildTabContext, type PhyloManifest } from "@/lib/taxon-view/tab-context";
import { resolveTabs } from "@/lib/taxon-view/tab-policy";

import { makeAmrPhenotypesView } from "./amr-phenotypes";
import { makeDomainsAndMotifsView } from "./domains-and-motifs";
import { makeEpitopesView } from "./epitopes";
import { makeExperimentsView } from "./experiments";
import { makeFeaturesView } from "./features";
import { makeGenomesView } from "./genomes";
import { makeInteractionsView } from "./interactions";
import { makeOverviewView } from "./overview";
import { makePhylogenyView } from "./phylogeny";
import { makeProteinStructuresView } from "./protein-structures";
import { scopeRoots, type TaxonViewScope } from "./scope";
import { makeSequencesView } from "./sequences";
import { makeSerologyView } from "./serology";
import { makeSfvtView } from "./sfvt";
import { makeStrainsView } from "./strains";
import { makeSurveillanceView } from "./surveillance";
import { makeTaxonomyTreeView } from "./taxonomy-tree-view";

interface BuildTaxonViewsOptions {
  config: OrganismLandingConfig;
  scope: TaxonViewScope;
  taxon: OrganismTaxonomy;
  phyloManifest?: PhyloManifest | null;
  OverviewComponent?: ComponentType;
  surface: "taxonomy" | "landing";
}

export function buildTaxonViews({
  config,
  scope,
  taxon,
  phyloManifest = null,
  OverviewComponent,
  surface,
}: BuildTaxonViewsOptions): OrganismLandingView[] {
  const lists = getCuratedLists();
  // Each root's own Phylogeny gate, as its taxonomy page would compute it, so
  // the tree's Trees link only points at a tab that is enabled there.
  const phylogenyTaxonIds = scopeRoots(scope)
    .filter((root) =>
      hasBacterialOrViralPhylogeny(buildTabContext(root, phyloManifest, lists)),
    )
    .map((root) => root.taxonId);
  const views = resolveTabs(buildTabContext(taxon, phyloManifest, lists, scopeRoots(scope)), {
    overview: {
      Component:
        OverviewComponent ??
        makeOverviewView({ config, taxon, showAmr: config.showAmr ?? false }),
    },
    phylogeny: { Component: makePhylogenyView({ taxon }), layout: "fill" },
    "taxa-tree": { Component: makeTaxonomyTreeView({ scope, phylogenyTaxonIds }), layout: "fill" },
    genomes: { Component: makeGenomesView({ scope }), layout: "fill" },
    "amr-phenotypes": { Component: makeAmrPhenotypesView({ scope }), layout: "fill" },
    sequences: { Component: makeSequencesView({ scope }), layout: "fill" },
    "protein-structures": { Component: makeProteinStructuresView({ scope }), layout: "fill" },
    "domains-and-motifs": { Component: makeDomainsAndMotifsView({ scope }), layout: "fill" },
    features: { Component: makeFeaturesView({ scope }), layout: "fill" },
    experiments: { Component: makeExperimentsView({ scope }), layout: "fill" },
    strains: { Component: makeStrainsView({ scope }), layout: "fill" },
    surveillance: { Component: makeSurveillanceView({ scope }), layout: "fill" },
    serology: { Component: makeSerologyView({ scope }), layout: "fill" },
    sfvt: { Component: makeSfvtView({ scope, sfvtTaxonIds: lists.sfvtTaxonIds }), layout: "fill" },
    epitopes: { Component: makeEpitopesView({ scope }), layout: "fill" },
    interactions: { Component: makeInteractionsView({ scope }), layout: "fill" },
  });

  if (surface === "landing") {
    const phylogeny = views.find((view) => view.key === "phylogeny");
    if (phylogeny) {
      phylogeny.enabled = false;
      phylogeny.disabledReason = "Phylogeny is available from taxonomy detail pages.";
    }
  }

  return views;
}
