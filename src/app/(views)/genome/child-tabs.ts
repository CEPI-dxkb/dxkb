import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import type { DataResource } from "@/lib/data-api";
import type { ChildCollectionUrlKey } from "@/lib/views/child-collection-state";
import { genomeSequenceColumns } from "@/lib/views/child-resources";

interface GenomeChildCollection {
  urlKey: ChildCollectionUrlKey;
  resource: DataResource;
  label: string;
  idField: string;
  defaultSort: string;
  columns?: ResourceCollectionProfile<Record<string, unknown>>["columns"];
}

/**
 * Child resources shared by the Genome collection and Genome member tabs. Only the
 * RQL scope and keyword mode differ between the two pages, so resource identity,
 * label, id field, sort, columns and URL param prefix are defined once here. Each
 * `urlKey` is unique so two tabs never read one another's page or sort.
 *
 * `genome_feature`, `protein_feature` and `protein_structure` deliberately carry no
 * columns — ResourceChildCollection substitutes the resource's own collection profile
 * (columns, detail fields, facets and row links) and ignores any columns prop for
 * those three.
 */
export const genomeChildCollections = {
  sequences: {
    urlKey: "sequences",
    resource: "genome_sequence",
    label: "Sequences",
    idField: "sequence_id",
    defaultSort: "sequence_id:asc",
    columns: genomeSequenceColumns,
  },
  features: {
    urlKey: "features",
    resource: "genome_feature",
    label: "Features",
    idField: "feature_id",
    defaultSort: "patric_id:asc",
  },
  proteins: {
    urlKey: "proteins",
    resource: "genome_feature",
    label: "Proteins",
    idField: "feature_id",
    defaultSort: "patric_id:asc",
  },
  domains: {
    urlKey: "domains",
    resource: "protein_feature",
    label: "Domains and Motifs",
    idField: "id",
    defaultSort: "unsorted",
  },
} as const satisfies Record<string, GenomeChildCollection>;
