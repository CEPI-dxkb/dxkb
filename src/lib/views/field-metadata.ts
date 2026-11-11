import type { DataTableColumn } from "@/components/shared/data-table";
import type { ResourceCollectionFacet } from "@/components/views/resource-collection";
import type { DataField, DataFieldMap } from "@/constants/datafields/types";
import { getResourceDefinition, type DataResource } from "@/lib/data-api";

/**
 * Derives columns, detail projection, facets and the URL sort allowlist in one
 * pass, so the table and the URL cannot disagree about what is sortable.
 * `show_in_table` gates column existence (and so sorting), `hidden` only a
 * column's initial visibility, and sortability comes from the registry's
 * `sortable`, the same value `validateSort` enforces. A hidden scalar field
 * stays sortable.
 */
export interface FieldMetadataPolicy {
  resource: DataResource;
  excludeFields?: readonly string[];
  /**
   * `"omit"` affects columns only: the field keeps its sort, because dropping
   * it would make a URL that used to order rows silently fall back to unsorted.
   * Feature is the only `"omit"` resource.
   */
  hiddenColumns?: "collapse" | "omit";
  hiddenFacets?: "collapse" | "omit";
  /**
   * Shapes columns only: `sorts` is derived from the metadata and registry, so
   * an adapter cannot widen or narrow the URL sort allowlist.
   */
  adaptColumn?: (column: DataTableColumn, field: DataField) => DataTableColumn;
}

export interface DerivedFieldMetadata {
  columns: readonly DataTableColumn[];
  detailFields: readonly string[];
  facets: readonly ResourceCollectionFacet[];
  /**
   * Derived from the `facet` flag alone, so unaffected by `hiddenFacets`.
   * Feature's is six fields wider than `facets`, but Feature hard-codes its own
   * `friendlyFilters`, so those six are not legal Feature URL filters; wiring
   * this list in would be a behaviour change.
   */
  facetFields: readonly string[];
  /**
   * Always a superset of the sortable columns; equal to them unless the
   * resource omits hidden columns (Feature only).
   */
  sorts: readonly string[];
}

/**
 * Every sortable column is in `sorts`, so the table never offers a header the
 * URL then refuses; the converse is allowed.
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

  // A field the registry does not know cannot be sorted: the gateway would
  // reject it.
  const isSortable = (name: string) =>
    Object.hasOwn(registryFields, name) && registryFields[name].sortable;

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
