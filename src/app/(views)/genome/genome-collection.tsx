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
} from "@/components/views";
import { genomeBaseRql } from "@/lib/genome-view";
import { proteinStructureCollectionProfile } from "@/lib/protein-structure-view";
import { genomeSequenceColumns } from "@/lib/views/child-resources";
import type { CollectionState } from "@/lib/views/collection-state";

const genomeCollectionTabs = [
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
] as const;

type GenomeCollectionTab = (typeof genomeCollectionTabs)[number]["key"];

function relatedGenomeRql(rql: string, extra?: string) {
  const relationship = `genome(${rql})`;
  return extra
    ? `and(eq(genome_id,*),${relationship},${extra})`
    : `and(eq(genome_id,*),${relationship})`;
}

export function GenomeCollection({
  initialState,
}: {
  initialState: CollectionState;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = genomeCollectionTabs.some(
    (tab) => tab.key === requestedTab && !("enabled" in tab),
  )
    ? (requestedTab as GenomeCollectionTab)
    : "genomes";
  const genomeRql = initialState.rql ?? genomeBaseRql(initialState);
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
        resource="genome_sequence"
        label="Sequences"
        idField="sequence_id"
        rql={relatedGenomeRql(genomeRql)}
        columns={genomeSequenceColumns}
        defaultSort="sequence_id:asc"
        keywordMode="loaded"
      />
    );
  } else if (
    genomeRql &&
    (activeTab === "features" || activeTab === "proteins")
  ) {
    const featureRql = relatedGenomeRql(
      genomeRql,
      activeTab === "proteins" ? "eq(feature_type,CDS)" : undefined,
    );
    content = (
      <ResourceChildCollection
        resource="genome_feature"
        label={activeTab === "proteins" ? "Proteins" : "Features"}
        idField="feature_id"
        rql={featureRql}
        defaultSort="patric_id:asc"
        keywordMode="loaded"
      />
    );
  } else if (genomeRql && activeTab === "domains") {
    content = (
      <ResourceChildCollection
        resource="protein_feature"
        label="Domains and Motifs"
        idField="id"
        rql={relatedGenomeRql(genomeRql)}
        defaultSort="unsorted"
        keywordMode="loaded"
      />
    );
  } else if (genomeRql && activeTab === "structures") {
    content = (
      <ResourceChildCollection
        resource="protein_structure"
        label="Protein Structures"
        idField="pdb_id"
        rql={relatedGenomeRql(genomeRql)}
        columns={proteinStructureCollectionProfile.columns}
        defaultSort="unsorted"
        guideUrl={proteinStructureCollectionProfile.guideUrl}
        keywordMode="loaded"
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
