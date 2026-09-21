import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/**
 * The single field-metadata pass behind Feature's columns, details, facets and sorts.
 *
 * Feature is the one resource that omits rather than collapses both hidden kinds:
 * - `hiddenColumns: "omit"` — the established Feature table is a fixed short set of
 *   columns, not a long collapsed list. Strain and the rest collapse instead, keeping
 *   the column toggleable; that disagreement is deliberate and documented in
 *   `docs/architecture.md`, not something this pass resolves.
 * - `hiddenFacets: "omit"` — the high-cardinality hidden facets (product, gene, families,
 *   GO) make the upstream combined facet query time out.
 *
 * Omitting a hidden column does not remove its sort: `plfam_id:asc` and the other 22
 * hidden scalar sorts keep working, because `hidden` is a visibility flag and only
 * array-valued cardinality makes a field unsortable. Feature is therefore the one
 * resource whose sort allowlist is wider than its sortable columns.
 */
export const featureMetadata = deriveFieldMetadata(genomeFeatureFields, {
  resource: "genome_feature",
  hiddenColumns: "omit",
  hiddenFacets: "omit",
});
