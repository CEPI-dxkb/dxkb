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
import type { DataResource } from "@/lib/data-api";
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

/**
 * The related tabs whose records carry no genome ID, so they follow only the
 * keyword and taxon parts of the list's query (`genomeTaxonScope`).
 */
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
  /** The Overview tab's content, rendered by the page while that tab is open. */
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
  } else if (activeTab === "strains") {
    // Strains join to the listed genomes through their multi-valued genome_ids.
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
      tabs={tabs}
      activeTab={activeTab}
      defaultTab="genomes"
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
