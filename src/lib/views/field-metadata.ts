import type { DataTableColumn } from "@/components/shared/data-table";
import type { ResourceCollectionFacet } from "@/components/views/resource-collection";
import type { DataField, DataFieldMap } from "@/constants/datafields/types";
import { getResourceDefinition, type DataResource } from "@/lib/data-api";

/**
 * One contract for the four overlapping visibility flags on {@link DataField}, plus the
 * cardinality the Data API registry owns. Every collection view derives its columns,
 * detail projection, facets and URL sort allowlist from this single pass, so the table
 * and the URL can never disagree about what is sortable.
 *
 * | Flag                        | Owns                                                                          |
 * | --------------------------- | ----------------------------------------------------------------------------- |
 * | `show_in_table`             | Column existence. `false` ⇒ no column, and therefore no accepted sort.         |
 * | `hidden`                    | A column's *initial visibility* only. It does NOT affect sortability.          |
 * | `facet`                     | Facet existence, and the field's eligibility as a friendly URL filter.         |
 * | `facet_hidden`              | Default facet visibility. `true` ⇒ collapsed (or omitted — see policy).        |
 * | `sortable` + registry cardinality | Sortability. Never re-derived per entity.                               |
 *
 * Sortability is the Data API registry's answer, not the metadata's alone:
 * `resourceRegistry[resource].fields[name].sortable` is already
 * `field.cardinality === "scalar" && metadata.sortable !== false` — derived from the
 * same field's declared cardinality, in the same pass — and it is the same value
 * `validateSort` enforces at the API boundary (`src/lib/data-api/validation.ts`). Deriving
 * from it is what stops a field the registry *declares* array-valued from advertising a
 * sort the backend rejects. A hidden scalar field stays sortable, because `hidden` is a
 * visibility flag, not a permission.
 *
 * The registry's `multipleFields` table covers 8 of 16 resources, so declared cardinality
 * is not the whole story: `genome_feature` has no entry, and its multi-valued `go` is
 * still carried by `DataField.sortable: false`. Both routes land in the same registry
 * `sortable` answer, which is why this helper reads only that — but "array-valued" here
 * means "declared array-valued", and widening `multipleFields` is a residual path.
 */
export interface FieldMetadataPolicy {
  /**
   * Registry key for the resource these fields belong to. Used only to read field
   * cardinality and sortability out of `resourceRegistry`; the helper has no per-resource
   * behaviour and never branches on this value.
   */
  resource: DataResource;
  /**
   * Fields dropped from every derived output, including the detail projection. Protein
   * Structure uses this for `sequence` and `alignments`, which are too large to project.
   */
  excludeFields?: readonly string[];
  /**
   * What `hidden: true` means for a column. `"collapse"` keeps the column so the
   * column-visibility menu can reveal it; `"omit"` drops it from the column set entirely.
   *
   * `"omit"` affects columns only. The field keeps its sort, because dropping a working
   * sort would make a URL that used to order rows correctly fall back to unsorted with
   * no error — the worst failure shape available. Feature is the only `"omit"` resource,
   * so Feature is the only place the sort allowlist is wider than the sortable columns.
   */
  hiddenColumns?: "collapse" | "omit";
  /**
   * What `facet_hidden: true` means for a facet. `"collapse"` keeps the facet with
   * `initiallyVisible: false`; `"omit"` drops it from the combined facet query entirely.
   */
  hiddenFacets?: "collapse" | "omit";
  /**
   * Per-column hook for the entity extras the metadata cannot express — `valueHref`
   * defaulting, `fallbackValue` accessors. It shapes columns only: `sorts` is derived
   * from the field metadata and the registry, so an adapter cannot widen or narrow the
   * URL sort allowlist behind the contract's back.
   */
  adaptColumn?: (column: DataTableColumn, field: DataField) => DataTableColumn;
}

export interface DerivedFieldMetadata {
  /** Table columns, in metadata order. */
  columns: readonly DataTableColumn[];
  /** Fields safe to project for the detail panel. */
  detailFields: readonly string[];
  /** Facet definitions for the combined facet query. */
  facets: readonly ResourceCollectionFacet[];
  /**
   * Every field flagged `facet`, derived from that flag alone and so unaffected by
   * `hiddenFacets`. This is the list entities spread into `friendlyFilters`.
   *
   * It therefore equals `facets` for every resource that *collapses* hidden facets — all
   * of them except Feature. Feature's is wider by six fields, but Feature hard-codes its
   * own `friendlyFilters` (`feature-view/query.ts`) and never reads this list, so **those
   * six are not legal Feature URL filters today.** Wiring `facetFields` into Feature's
   * `friendlyFilters` would activate six filter names the view has never accepted; that
   * is a behaviour change, not a tidy-up.
   */
  facetFields: readonly string[];
  /**
   * `field:asc` / `field:desc` for every `show_in_table` field the registry calls
   * sortable. Always a superset of the sortable columns, and equal to them unless the
   * resource omits hidden columns (Feature only).
   */
  sorts: readonly string[];
}

/**
 * Derive every field-driven capability of a collection view in one pass.
 *
 * The load-bearing invariant runs in one direction: every sortable *column* is in `sorts`,
 * so the table never offers a header the URL then refuses. The converse is allowed — a
 * resource that omits its hidden columns still accepts their sorts.
 */
export function deriveFieldMetadata(
  fieldMap: DataFieldMap,
  policy: FieldMetadataPolicy,
): DerivedFieldMetadata {
  const registryFields = getResourceDefinition(policy.resource).fields;
  const excluded = new Set(policy.excludeFields ?? []);
  const fields = Object.values(fieldMap).filter(
    (field) => !excluded.has(field.field),
  );

  // A field the registry does not know cannot be sorted: the gateway would reject it,
  // so never offer the header.
  const isSortable = (name: string) =>
    Object.hasOwn(registryFields, name) && registryFields[name].sortable;

  // `show_in_table` is the single gate on becoming a column, and so on being sortable.
  const tableFields = fields.filter((field) => field.show_in_table !== false);

  const columns = tableFields
    .filter((field) => !(policy.hiddenColumns === "omit" && field.hidden))
    .map((field) => {
      const column: DataTableColumn = {
        id: field.field,
        label: field.label,
        visible: !field.hidden,
        sortable: isSortable(field.field),
      };
      return policy.adaptColumn ? policy.adaptColumn(column, field) : column;
    });

  const facetCandidates = fields.filter((field) => field.facet);

  return {
    columns,
    detailFields: [...new Set(fields.map((field) => field.field))],
    facets: facetCandidates
      .filter(
        (field) =>
          !(policy.hiddenFacets === "omit" && field.facet_hidden === true),
      )
      .map((field) => ({
        field: field.field,
        label: field.label,
        initiallyVisible: field.facet_hidden !== true,
      })),
    facetFields: facetCandidates.map((field) => field.field),
    sorts: tableFields
      .filter((field) => isSortable(field.field))
      .flatMap((field) => [`${field.field}:asc`, `${field.field}:desc`]),
  };
}
