"use client";

import {
  Activity,
  Blocks,
  Dna,
  Eye,
  Globe,
  LayoutDashboard,
  Shapes,
  Waypoints,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  EntityViewShell,
  GenomeResourceCollection,
  ResourceChildCollection,
  type EntityViewTab,
} from "@/components/views";
import { genomeBaseRql, genomeStructuralRql } from "@/lib/genome-view";
import {
  genomesChildRql,
  proteinFeatureRql,
} from "@/lib/views/child-resources";
import { rqlAnd, rqlKeyword } from "@/lib/views/rql";
import { genomeChildCollections } from "./child-tabs";
import type { CollectionState } from "@/lib/views/collection-state";

type GenomeCollectionTab =
  | "overview"
  | "strains"
  | "genomes"
  | "sequences"
  | "features"
  | "proteins"
  | "structures"
  | "domains"
  | "epitopes"
  | "surveillance"
  | "serology";

const genomeCollectionTabs: readonly EntityViewTab<GenomeCollectionTab>[] = [
  {
    key: "overview",
    label: "Overview",
    icon: <LayoutDashboard />,
    enabled: false,
    disabledReason:
      "A combined overview is not available for multiple genomes.",
  },
  {
    key: "strains",
    label: "Strains",
    icon: <Activity />,
    enabled: false,
    disabledReason: "Multi-genome strain filtering is not yet available.",
  },
  { key: "genomes", label: "Genomes", icon: <Dna /> },
  { key: "sequences", label: "Sequences", icon: <Dna /> },
  { key: "features", label: "Features", icon: <Blocks /> },
  { key: "proteins", label: "Proteins", icon: <Activity /> },
  { key: "structures", label: "Protein Structures", icon: <Shapes /> },
  { key: "domains", label: "Domains and Motifs", icon: <Waypoints /> },
  {
    key: "epitopes",
    label: "Epitopes",
    icon: <Activity />,
    enabled: false,
    disabledReason: "Multi-genome epitope filtering is not yet available.",
  },
  {
    key: "surveillance",
    label: "Surveillance",
    icon: <Eye />,
    enabled: false,
    disabledReason: "Multi-genome surveillance filtering is not yet available.",
  },
  {
    key: "serology",
    label: "Serology",
    icon: <Globe />,
    enabled: false,
    disabledReason: "Multi-genome serology filtering is not yet available.",
  },
];

export function GenomeCollection({
  initialState,
}: {
  initialState: CollectionState;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab =
    genomeCollectionTabs.find(
      (tab) => tab.key === requestedTab && tab.enabled !== false,
    )?.key ?? "genomes";
  // Match the Genomes tab's effective query so child tabs stay scoped to exactly
  // the genomes currently listed, including URL-owned keyword and refinement text.
  const genomeScope = [
    genomeBaseRql(initialState),
    genomeStructuralRql(initialState),
    initialState.keyword?.trim()
      ? rqlKeyword(initialState.keyword.trim())
      : undefined,
    initialState.refine?.trim()
      ? rqlKeyword(initialState.refine.trim())
      : undefined,
    initialState.rql,
  ].filter((clause): clause is string => Boolean(clause));
  const genomeRql = genomeScope.length > 0 ? rqlAnd(...genomeScope) : undefined;
  let content = (
    <GenomeResourceCollection
      baseRql={genomeBaseRql(initialState)}
      initialState={initialState}
      keywordMode="refine"
    />
  );
  if (genomeRql && activeTab === "sequences") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.sequences}
        rql={genomesChildRql(genomeRql)}
        keywordMode="server"
      />
    );
  } else if (
    genomeRql &&
    (activeTab === "features" || activeTab === "proteins")
  ) {
    const featureRql = genomesChildRql(
      genomeRql,
      // Shared with the member Proteins view and the Feature list's
      // `filter=protein`, so all three mean the same thing by "protein".
      activeTab === "proteins" ? proteinFeatureRql : undefined,
    );
    content = (
      <ResourceChildCollection
        {...genomeChildCollections[activeTab]}
        rql={featureRql}
        keywordMode="server"
      />
    );
  } else if (genomeRql && activeTab === "domains") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.domains}
        rql={genomesChildRql(genomeRql)}
        keywordMode="server"
      />
    );
  } else if (genomeRql && activeTab === "structures") {
    // Not ProteinStructureResourceCollection (which the member page uses): that
    // wrapper owns URL collection state, which would collide with this page's own
    // rql/page/sort params. ResourceChildCollection keeps the tab state local and
    // supplies the canonical protein-structure profile (columns, detail fields,
    // facets and row links) from its own `protein_structure` branch.
    content = (
      <ResourceChildCollection
        resource="protein_structure"
        label="Protein Structures"
        idField="pdb_id"
        rql={genomesChildRql(genomeRql)}
        defaultSort="unsorted"
        keywordMode="server"
      />
    );
  }

  return (
    <EntityViewShell
      viewLabel="Genome View"
      title="Genomes"
      tabs={genomeCollectionTabs}
      activeTab={activeTab}
      defaultTab="genomes"
      layout="fill"
    >
      {content}
    </EntityViewShell>
  );
}
