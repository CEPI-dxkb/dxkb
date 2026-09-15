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

export interface ColumnInfo {
  id: string;
  label: string;
  visible: boolean;
  facet?: boolean;
  facet_hidden?: boolean;
}

export const resourceFields: Record<string, DataFieldMap | undefined> = {
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

export function deriveTableFields(resource: string): ColumnInfo[] {
  const cached = tableFieldsByResource.get(resource);
  if (cached) return cached;

  const fieldObj = resourceFields[resource];
  if (!fieldObj) {
    console.error(`No fields definition found for resource: ${resource}`);
    return emptyFields;
  }
  const fields: ColumnInfo[] = [];
  for (const field of Object.values(fieldObj)) {
    if (field.show_in_table !== false) {
      fields.push({
        id: field.field,
        label: field.label,
        visible: !field.hidden,
        facet: field.facet ?? false,
        facet_hidden: field.facet_hidden ?? true,
      });
    }
  }
  tableFieldsByResource.set(resource, fields);
  return fields;
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

export async function downloadResourceRows({
  dataApi,
  resource,
  query,
  totalItems,
  format,
  visibleColumns,
  fields,
}: {
  dataApi: string;
  resource: string;
  query: string;
  totalItems: number;
  format: "csv" | "txt";
  visibleColumns: string[] | null;
  fields: ColumnInfo[];
}): Promise<void> {
  const requestedColumns =
    visibleColumns !== null ? visibleColumns : fields.map((field) => field.id);
  const columns = requestedColumns.filter((id) => id !== "__select__");
  const selectClause = columns.length ? `&select(${columns.join(",")})` : "";
  const response = await fetch(
    `${dataApi}/${resource}/?${query}${selectClause}`,
    {
      headers: {
        "Content-type": "application/rqlquery+x-www-form-urlencoded",
        Accept: "application/json",
        Range: `items=0-${String(totalItems)}`,
        "X-Range": `items=0-${String(totalItems)}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch all data: ${String(response.status)} ${response.statusText}`,
    );
  }
  const payload = (await response.json()) as unknown;
  const payloadObject = payload as Record<string, unknown>;
  const rows = Array.isArray(payload)
    ? payload
    : ((payloadObject.items ??
        payloadObject.response ??
        payloadObject.rows ??
        []) as Record<string, unknown>[]);
  downloadLoadedResourceRows({
    resource,
    rows,
    format,
    visibleColumns,
    fields,
  });
}
