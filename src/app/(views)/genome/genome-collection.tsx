"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  EntityViewShell,
  GenomeResourceCollection,
  ResourceChildCollection,
  type EntityViewTab,
} from "@/components/views";
import { viewIcons } from "@/components/views/view-icons";
import type { DataResource, DataSort } from "@/lib/data-api";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import { featureListDefaultFilters } from "@/lib/feature-view";
import {
  genomeBaseRql,
  genomeOverviewScope,
  genomeRelatedScope,
  genomeTaxonScope,
} from "@/lib/genome-view";
import {
  genomeStrainsRql,
  genomesChildRql,
  proteinFeatureRql,
} from "@/lib/views/child-resources";
import { rqlAnd } from "@/lib/views/rql";
import { genomeChildCollections } from "./child-tabs";
import type { ChildCollectionUrlKey } from "@/lib/views/child-collection-state";
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
  { key: "overview", label: "Overview", icon: viewIcons.overview },
  { key: "strains", label: "Strains", icon: viewIcons.strains },
  { key: "genomes", label: "Genomes", icon: viewIcons.genomes },
  { key: "sequences", label: "Sequences", icon: viewIcons.sequences },
  { key: "features", label: "Features", icon: viewIcons.features },
  { key: "proteins", label: "Proteins", icon: viewIcons.proteins },
  {
    key: "structures",
    label: "Protein Structures",
    icon: viewIcons.proteinStructures,
  },
  {
    key: "domains",
    label: "Domains and Motifs",
    icon: viewIcons.domainsAndMotifs,
  },
  { key: "epitopes", label: "Epitopes", icon: viewIcons.epitopes },
  { key: "surveillance", label: "Surveillance", icon: viewIcons.surveillance },
  { key: "serology", label: "Serology", icon: viewIcons.serology },
];

const taxonScopedCollections = {
  epitopes: {
    urlKey: "epitopes",
    resource: "epitope",
    label: "Epitopes",
    idField: "epitope_id",
  },
  surveillance: {
    urlKey: "surveillance",
    resource: "surveillance",
    label: "Surveillance",
    idField: "id",
  },
  serology: {
    urlKey: "serology",
    resource: "serology",
    label: "Serology",
    idField: "id",
  },
} as const satisfies Partial<
  Record<
    GenomeCollectionTab,
    {
      urlKey: ChildCollectionUrlKey;
      resource: DataResource;
      label: string;
      idField: string;
    }
  >
>;

function isTaxonScopedTab(
  key: GenomeCollectionTab,
): key is keyof typeof taxonScopedCollections {
  return Object.hasOwn(taxonScopedCollections, key);
}

export function GenomeCollection({
  initialState,
  overview,
}: {
  initialState: CollectionState;
  overview?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const taxonScope = genomeTaxonScope(initialState);
  const overviewSupported = genomeOverviewScope(initialState) !== undefined;
  const tabs = genomeCollectionTabs.map((tab) => {
    if (tab.key === "overview" && !overviewSupported) {
      return {
        ...tab,
        enabled: false,
        disabledReason:
          "The overview summarizes public genomes, so it is not available for a list of private genomes.",
      };
    }
    if (isTaxonScopedTab(tab.key) && !taxonScope.supported) {
      return {
        ...tab,
        enabled: false,
        disabledReason: `${tab.label} records have no genome ID, so this tab follows only keyword and taxon filters. Clear the list's other genome filters to show it.`,
      };
    }
    return tab;
  });
  const activeTab =
    tabs.find((tab) => tab.key === requestedTab && tab.enabled !== false)
      ?.key ?? "genomes";
  const scope = genomeRelatedScope(initialState);
  // An unscoped tab sends its collection's match-all: the Data API answers 400
  // to an empty query once a sort or facet is added.
  const relatedRql = (idField: string, extra?: string): string => {
    if (!scope) return extra ?? `eq(${idField},*)`;
    if (scope.join) return genomesChildRql(scope.rql, extra);
    return extra ? rqlAnd(scope.rql, extra) : scope.rql;
  };
  // A global search adds #defaultSort=-score, so a keyword search's tabs keep
  // relevance order; other lists take their grid's own order.
  const gridOrder = (order: DataSort) =>
    keywordQuery(initialState.keyword ?? "").length > 0 ? undefined : order;
  // Legacy sends the keyword exactly as typed (coli finds 134,274 genomes,
  // coli* 137,836), so no prefix keyword reaches the Data API.
  let content = (
    <GenomeResourceCollection
      baseRql={genomeBaseRql(initialState)}
      initialState={initialState}
      keywordMode="refine"
      serverKeywordMode="exact"
    />
  );
  if (activeTab === "overview") {
    content = <>{overview}</>;
  } else if (activeTab === "sequences") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.sequences}
        rql={relatedRql(genomeChildCollections.sequences.idField)}
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "features") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.features}
        rql={relatedRql(genomeChildCollections.features.idField)}
        defaultFilters={featureListDefaultFilters}
        unsortedOrder={gridOrder(genomeChildCollections.features.unsortedOrder)}
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "proteins") {
    content = (
      <ResourceChildCollection
        {...genomeChildCollections.proteins}
        rql={relatedRql(
          genomeChildCollections.proteins.idField,
          proteinFeatureRql,
        )}
        unsortedOrder={gridOrder(genomeChildCollections.proteins.unsortedOrder)}
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
  } else if (activeTab === "strains") {
    content = (
      <ResourceChildCollection
        urlKey="strains"
        resource="strain"
        label="Strains"
        idField="id"
        rql={scope?.join ? genomeStrainsRql(scope.rql) : relatedRql("id")}
        defaultSort="unsorted"
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (isTaxonScopedTab(activeTab) && taxonScope.supported) {
    const collection = taxonScopedCollections[activeTab];
    content = (
      <ResourceChildCollection
        {...collection}
        rql={taxonScope.rql ?? `eq(${collection.idField},*)`}
        defaultSort="unsorted"
        keywordMode="server"
        serverKeywordMode="exact"
      />
    );
  } else if (activeTab === "structures") {
    // ProteinStructureResourceCollection owns URL state that would collide with
    // this page's rql/page/sort params; ResourceChildCollection keeps its state
    // under `<urlKey>.` params.
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
      tabs={tabs}
      activeTab={activeTab}
      defaultTab="genomes"
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
