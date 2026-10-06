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
import { featureListDefaultFilters } from "@/lib/feature-view";
import { genomeBaseRql, genomeRelatedScope } from "@/lib/genome-view";
import {
  genomesChildRql,
  proteinFeatureRql,
} from "@/lib/views/child-resources";
import { rqlAnd } from "@/lib/views/rql";
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
  const scope = genomeRelatedScope(initialState);
  // A related tab's predicate, following legacy GenomeList where it works
  // (`genomeRelatedScope`). An unscoped tab still sends its collection's own
  // match-all, as every collection profile does: the Data API answers HTTP 400
  // to an empty query once a sort or facet is added.
  const relatedRql = (idField: string, extra?: string): string => {
    if (!scope) return extra ?? `eq(${idField},*)`;
    if (scope.join) return genomesChildRql(scope.rql, extra);
    return extra ? rqlAnd(scope.rql, extra) : scope.rql;
  };
  // Legacy GenomeList sends the keyword exactly as typed: keyword(coli) finds
  // 134,274 genomes, the token-prefix keyword(coli*) 137,836. The related tabs'
  // own keyword boxes are exact too (`serverKeywordMode="exact"`), so no
  // prefix keyword reaches the Data API from this page.
  let content = (
    <GenomeResourceCollection
      baseRql={genomeBaseRql(initialState)}
      initialState={initialState}
      keywordMode="refine"
      serverKeywordMode="exact"
    />
  );
  if (activeTab === "sequences") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.sequences}
        rql={relatedRql(genomeChildCollections.sequences.idField)}
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "features") {
    // Legacy's Features tab: the Feature list's removable annotation=PATRIC
    // default, and rows in backend order (the Feature list's sort decision).
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.features}
        rql={relatedRql(genomeChildCollections.features.idField)}
        defaultFilters={featureListDefaultFilters}
        defaultSort="unsorted"
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "proteins") {
    // `proteinFeatureRql` is shared with the member Proteins view and the
    // Feature list's `filter=protein`, so all three mean the same "protein".
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.proteins}
        rql={relatedRql(
          genomeChildCollections.proteins.idField,
          proteinFeatureRql,
        )}
        defaultSort="unsorted"
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "domains") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.domains}
        rql={relatedRql(genomeChildCollections.domains.idField)}
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "structures") {
    // Not ProteinStructureResourceCollection (which the member page uses): that
    // wrapper owns URL collection state, which would collide with this page's own
    // rql/page/sort params. ResourceChildCollection keeps its tab state under its
    // own `<urlKey>.` params, so they never collide with this page's, and it
    // supplies the canonical protein-structure profile (columns, detail fields,
    // facets and row links) from its own `protein_structure` branch.
    content = (
      <ResourceChildCollection
        urlKey="structures"
        resource="protein_structure"
        label="Protein Structures"
        idField="pdb_id"
        rql={relatedRql("pdb_id")}
        defaultSort="unsorted"
        keywordMode="server"
        serverKeywordMode="exact"
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
