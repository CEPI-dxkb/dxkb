import type { DataTableColumn } from "@/components/shared/data-table";

/** Download output keeps the legacy "; " separator; strain copy asks for ";". */
const defaultArraySeparator = "; ";

function exportValue(
  value: unknown,
  format: "csv" | "txt",
  arraySeparator: string,
): string {
  if (value == null) return "";
  let serialized: string;
  if (Array.isArray(value)) serialized = value.map(String).join(arraySeparator);
  else if (typeof value === "object") serialized = JSON.stringify(value);
  else if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  )
    serialized = String(value);
  else serialized = "";
  const cleaned = serialized.replace(/\r\n|\n|\r/g, " ");
  if (format === "txt") return cleaned.replaceAll("\t", " ");
  const safe = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeResourceRows(
  rows: readonly Record<string, unknown>[],
  columns: readonly DataTableColumn[],
  fields: readonly string[],
  format: "csv" | "txt",
  includeHeaders = true,
  arraySeparator = defaultArraySeparator,
): string {
  const separator = format === "csv" ? "," : "\t";
  const headers = fields.map(
    (field) => columns.find((column) => column.id === field)?.label ?? field,
  );
  return [
    ...(includeHeaders ? [headers.join(separator)] : []),
    ...rows.map((row) =>
      fields
        .map((field) => exportValue(row[field], format, arraySeparator))
        .join(separator),
    ),
  ].join("\n");
}

export function downloadResourceExport(
  resource: string,
  rows: readonly Record<string, unknown>[],
  columns: readonly DataTableColumn[],
  fields: readonly string[],
  format: "csv" | "txt",
  // Defaults to "all" so every existing caller (e.g. resource-collection.tsx,
  // for both its all-rows and selected-rows exports) keeps today's filename.
  // Plan item 14 owns unifying parent/child collection export filenames —
  // this default must not pre-empt that decision.
  variant: "all" | "selected" = "all",
  // Overrides the filename's base segment, which otherwise defaults to
  // `resource`. `ResourceChildCollection` (plan item 14) passes its tab label
  // here so a child export keeps naming its download after the tab (e.g.
  // "Domains and Motifs" -> "domains and motifs.csv") instead of switching to
  // the shared resource id, which would silently rename every child export.
  fileNameBase: string = resource,
) {
  const content = serializeResourceRows(rows, columns, fields, format);
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    variant === "selected"
      ? `${fileNameBase}-selected.${format}`
      : `${fileNameBase}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
