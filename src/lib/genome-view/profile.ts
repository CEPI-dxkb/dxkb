import type { ResourceCollectionProfile } from "@/components/views";
import { genomeMetadata } from "./fields";
import { genomeStructuralRql } from "./query";
import type { GenomeViewRecord } from "./schema";

const genomeColumns = genomeMetadata.columns;
const genomeDetailFields = genomeMetadata.detailFields;
const genomeFacets = genomeMetadata.facets;

export const genomeCollectionProfile: ResourceCollectionProfile<GenomeViewRecord> =
  {
    resource: "genome",
    label: "Genomes",
    idField: "genome_id",
    columns: genomeColumns,
    detailFields: genomeDetailFields,
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
