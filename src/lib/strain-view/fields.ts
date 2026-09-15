import { strainFields } from "@/constants/datafields/strain";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/**
 * Segment and accession columns hold GenBank accessions, so they link into NCBI nuccore
 * even though the metadata carries no `link` for most of them. The Data API registry
 * already records every one of them as array-valued, which is what makes them
 * unsortable — this set is about link destinations only.
 */
const accessionFields = new Set([
  "genbank_accessions",
  "1_pb2",
  "2_pb1",
  "3_pa",
  "4_ha",
  "5_np",
  "6_na",
  "7_mp",
  "8_ns",
  "s",
  "m",
  "l",
  "other_segments",
]);

/** The single field-metadata pass behind Strain's columns, details, facets and sorts. */
export const strainMetadata = deriveFieldMetadata(strainFields, {
  resource: "strain",
  adaptColumn: (column, field) => ({
    ...column,
    valueHref:
      field.link ??
      (accessionFields.has(field.field)
        ? "https://www.ncbi.nlm.nih.gov/nuccore/{value}"
        : undefined),
  }),
});
