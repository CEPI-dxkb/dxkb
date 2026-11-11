import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** `sequence` and `alignments` are whole-molecule payloads, excluded from every derived output. */
const unsafeProjectionFields = ["sequence", "alignments"];

/** `pdb_id`'s metadata link points at RCSB; it is suppressed so the profile's `rowHref` opens the internal viewer. */
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
