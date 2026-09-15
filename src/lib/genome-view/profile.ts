import type { ResourceCollectionProfile } from "@/components/views";
import { genomeMetadata } from "./fields";
import { genomeStructuralRql } from "./query";
import type { GenomeViewRecord } from "./schema";

export const genomeColumns = genomeMetadata.columns;
export const genomeDetailFields = genomeMetadata.detailFields;
export const genomeFacets = genomeMetadata.facets;

export const genomeCollectionProfile: ResourceCollectionProfile<GenomeViewRecord> =
  {
    resource: "genome",
    label: "Genomes",
    idField: "genome_id",
    columns: genomeColumns,
    detailFields: genomeDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(genome_id,*)",
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/genomes.html",
    buildStructuralRql: genomeStructuralRql,
    facets: genomeFacets,
    rowHref: (row) =>
      row.genome_id
        ? `/genome/${encodeURIComponent(row.genome_id)}`
        : undefined,
    rowLinkField: "genome_name",
  };
