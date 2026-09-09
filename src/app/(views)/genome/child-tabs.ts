import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import type { DataResource } from "@/lib/data-api";
import { genomeSequenceColumns } from "@/lib/views/child-resources";

interface GenomeChildCollection {
  resource: DataResource;
  label: string;
  idField: string;
  defaultSort: string;
  columns?: ResourceCollectionProfile<Record<string, unknown>>["columns"];
}

/**
 * Child resources shared by the Genome collection and Genome member tabs. Only the
 * RQL scope and keyword mode differ between the two pages, so resource identity,
 * label, id field, sort and columns are defined once here.
 *
 * `genome_feature` and `protein_feature` deliberately carry no columns —
 * ResourceChildCollection substitutes the resource's own collection profile and
 * ignores any columns prop for those two.
 */
export const genomeChildCollections = {
  sequences: {
    resource: "genome_sequence",
    label: "Sequences",
    idField: "sequence_id",
    defaultSort: "sequence_id:asc",
    columns: genomeSequenceColumns,
  },
  features: {
    resource: "genome_feature",
    label: "Features",
    idField: "feature_id",
    defaultSort: "patric_id:asc",
  },
  proteins: {
    resource: "genome_feature",
    label: "Proteins",
    idField: "feature_id",
    defaultSort: "patric_id:asc",
  },
  domains: {
    resource: "protein_feature",
    label: "Domains and Motifs",
    idField: "id",
    defaultSort: "unsorted",
  },
} as const satisfies Record<string, GenomeChildCollection>;
