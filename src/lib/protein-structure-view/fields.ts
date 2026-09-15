import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/**
 * `sequence` and `alignments` are whole-molecule payloads: projecting them blows the
 * collection response up, so they are excluded from every derived output, detail
 * projection included.
 */
const unsafeProjectionFields = ["sequence", "alignments"];

/**
 * The single field-metadata pass behind Protein Structure's columns, details, facets and
 * sorts. `pdb_id`'s metadata link points at RCSB; suppressing it lets the profile's
 * canonical `rowHref` open the internal structure viewer instead.
 */
export const proteinStructureMetadata = deriveFieldMetadata(
  proteinStructureFields,
  {
    resource: "protein_structure",
    excludeFields: unsafeProjectionFields,
    adaptColumn: (column, field) => ({
      ...column,
      valueHref: field.field === "pdb_id" ? undefined : field.link,
    }),
  },
);
