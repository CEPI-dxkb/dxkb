import type { DataFieldMap } from "@/constants/datafields/types";
import { genomeFields } from "@/constants/datafields/genome";
import { genomeAmrFields } from "@/constants/datafields/genome_amr";
import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import { sequenceFeatureFields } from "@/constants/datafields/sequence_feature";
import { strainFields } from "@/constants/datafields/strain";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import { serologyFields } from "@/constants/datafields/serology";
import { taxonomyFields } from "@/constants/datafields/taxonomy";
import { biosetFields } from "@/constants/datafields/bioset";
import { epitopeFields } from "@/constants/datafields/epitope";
import { experimentFields } from "@/constants/datafields/experiment";
import { ppiFields } from "@/constants/datafields/ppi";
import { resourceRegistry } from "@/lib/data-api";
import type { DataResource } from "@/lib/data-api";

export interface ColumnInfo {
  id: string;
  label: string;
  visible: boolean;
  /**
   * Whether the table may ask the gateway to sort on this column. Derived from
   * `resourceRegistry`, which is the same value `validateSort` enforces at the
   * gateway, so a sortable header can never produce a rejected request.
   */
  sortable: boolean;
  facet?: boolean;
  facet_hidden?: boolean;
}

export const resourceFields: Partial<Record<DataResource, DataFieldMap>> = {
  genome: genomeFields,
  genome_amr: genomeAmrFields,
  genome_feature: genomeFeatureFields,
  genome_sequence: genomeSequenceFields,
  protein_feature: proteinFeatureFields,
  protein_structure: proteinStructureFields,
  sequence_feature: sequenceFeatureFields,
  strain: strainFields,
  surveillance: surveillanceFields,
  serology: serologyFields,
  taxonomy: taxonomyFields,
  bioset: biosetFields,
  epitope: epitopeFields,
  experiment: experimentFields,
  ppi: ppiFields,
};

const emptyFields: ColumnInfo[] = [];
const tableFieldsByResource = new Map<string, ColumnInfo[]>();

/**
 * The legacy table's columns: order, labels and initial visibility come from
 * `datafields/*` (unchanged), sortability comes from the Data API registry.
 */
export function deriveTableFields(resource: DataResource): ColumnInfo[] {
  const cached = tableFieldsByResource.get(resource);
  if (cached) return cached;

  const fieldObj = resourceFields[resource];
  if (!fieldObj) {
    console.error(`No fields definition found for resource: ${resource}`);
    return emptyFields;
  }
  // `resourceRegistry` derives its field map from the same `datafields/*`
  // source, so every column below resolves to an entry here. The `hasOwn`
  // guard reports a column that somehow does not as unsortable rather than
  // letting the lookup miss decide: nothing proves the gateway would accept a
  // sort on a field it has no metadata for. (The index type is not optional,
  // so this cannot be written as `?.sortable ?? false`.)
  const registryFields = resourceRegistry[resource].fields;
  const fields: ColumnInfo[] = [];
  for (const field of Object.values(fieldObj)) {
    if (field.show_in_table !== false) {
      fields.push({
        id: field.field,
        label: field.label,
        visible: !field.hidden,
        sortable: Object.hasOwn(registryFields, field.field)
          ? registryFields[field.field].sortable
          : false,
        facet: field.facet ?? false,
        facet_hidden: field.facet_hidden ?? true,
      });
    }
  }
  tableFieldsByResource.set(resource, fields);
  return fields;
}

/**
 * Every column the row payload must carry, whether or not it is shown: the
 * detail panel renders `show_in_table: false` fields too, so narrowing this to
 * the visible columns would blank them out.
 */
export function projectedFields(
  resource: DataResource,
  idField: string,
): string[] {
  const fieldMap = resourceFields[resource];
  if (!fieldMap) return [idField];
  return [
    ...new Set([idField, ...Object.values(fieldMap).map((f) => f.field)]),
  ];
}

export function findPageRow(
  pageData: Record<string, unknown>[],
  idField: string,
  id: string,
): Record<string, unknown> | undefined {
  return pageData.find((row) => String(row[idField]) === id);
}

export function isSameResourceQuery(
  previousQueryKey: readonly unknown[] | undefined,
  resource: string,
): boolean {
  return previousQueryKey?.[1] === resource;
}

function exportValue(value: unknown, format: "csv" | "txt"): string {
  if (value == null) return "";
  let serialized: string;
  if (typeof value === "object") {
    serialized = JSON.stringify(value);
  } else if (typeof value === "symbol") {
    serialized = value.description ?? value.toString();
  } else if (typeof value === "string") {
    serialized = value;
  } else if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    serialized = String(value);
  } else {
    serialized = "";
  }
  const cleaned = serialized.replace(/\r\n|\n|\r/g, " ");
  if (format === "txt") return cleaned.replaceAll("\t", " ");
  const safe = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${safe.replace(/"/g, "\"\"")}"`;
}

/**
 * Serialize and download `rows` the caller already holds. Used for both
 * all-rows exports (whose rows come from the Data API repository, or from the
 * loaded page when the keyword filter is client-side) so a single serializer
 * and a single filename shape covers every all-rows download.
 */
export function downloadLoadedResourceRows({
  resource,
  rows,
  format,
  visibleColumns,
  fields,
  // Defaults to "all" so the existing handleDownloadAll call site keeps
  // today's `${resource}-all.${format}` filename unchanged.
  variant = "all",
}: {
  resource: string;
  rows: readonly Record<string, unknown>[];
  format: "csv" | "txt";
  visibleColumns: string[] | null;
  fields: ColumnInfo[];
  variant?: "all" | "selected";
}): void {
  const requestedColumns =
    visibleColumns !== null ? visibleColumns : fields.map((field) => field.id);
  const columns = requestedColumns.filter((id) => id !== "__select__");
  const separator = format === "csv" ? "," : "\t";
  const headers = columns.map(
    (id) => fields.find((field) => field.id === id)?.label ?? id,
  );
  const contentRows = rows.map((row) =>
    columns.map((columnId) => exportValue(row[columnId], format)).join(separator),
  );
  const content = [headers.join(separator), ...contentRows].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${resource}-${variant}.${format}`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
