import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import { proteinStructureHref } from "@/lib/views/hrefs";
import { proteinStructureMetadata } from "./fields";
import { proteinStructureStructuralRql } from "./query";
import type { ProteinStructureViewRecord } from "./schema";

export const proteinStructureColumns = proteinStructureMetadata.columns;
export const proteinStructureDetailFields =
  proteinStructureMetadata.detailFields;
export const proteinStructureFacets = proteinStructureMetadata.facets;

export const proteinStructureCollectionProfile: ResourceCollectionProfile<ProteinStructureViewRecord> =
  {
    resource: "protein_structure",
    label: "Protein Structures",
    idField: "pdb_id",
    columns: proteinStructureColumns,
    detailFields: proteinStructureDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(pdb_id,*)",
    buildStructuralRql: proteinStructureStructuralRql,
    facets: proteinStructureFacets,
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/protein_structures.html",
    rowHref: (row) => proteinStructureHref(row.pdb_id),
    rowLinkField: "pdb_id",
  };
