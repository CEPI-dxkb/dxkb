import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import type { DataResource, DataSort } from "@/lib/data-api";
import type { CollectionDownloadSpec } from "@/lib/data-api/downloads";
import { featureGridDefaultOrder } from "@/lib/feature-view";
import type { ChildCollectionUrlKey } from "@/lib/views/child-collection-state";
import { proteinDownloadSpec } from "@/lib/views/child-resources";

interface GenomeChildCollection {
  urlKey: ChildCollectionUrlKey;
  resource: DataResource;
  label: string;
  idField: string;
  defaultSort: string;
  unsortedOrder?: DataSort;
  columns?: ResourceCollectionProfile<Record<string, unknown>>["columns"];
  download?: CollectionDownloadSpec;
}

/**
 * `genome_feature`, `protein_feature` and `protein_structure` carry no columns:
 * ResourceChildCollection substitutes the resource's own collection profile.
 */
export const genomeChildCollections = {
  // Legacy AMRPanelGrid adds no sort; genome_amr's own profile supplies the
  // columns, facets and detail fields.
  amr: {
    urlKey: "amr",
    resource: "genome_amr",
    label: "AMR Phenotypes",
    idField: "id",
    defaultSort: "unsorted",
  },
  sequences: {
    urlKey: "sequences",
    resource: "genome_sequence",
    label: "Sequences",
    idField: "sequence_id",
    defaultSort: "sequence_id:asc",
  },
  // Legacy order: features run along each sequence from position 1, with no
  // sorted column.
  features: {
    urlKey: "features",
    resource: "genome_feature",
    label: "Features",
    idField: "feature_id",
    defaultSort: "unsorted",
    unsortedOrder: featureGridDefaultOrder,
  },
  proteins: {
    urlKey: "proteins",
    resource: "genome_feature",
    label: "Proteins",
    idField: "feature_id",
    defaultSort: "unsorted",
    unsortedOrder: featureGridDefaultOrder,
    download: proteinDownloadSpec,
  },
  domains: {
    urlKey: "domains",
    resource: "protein_feature",
    label: "Domains and Motifs",
    idField: "id",
    defaultSort: "unsorted",
  },
} as const satisfies Record<string, GenomeChildCollection>;
