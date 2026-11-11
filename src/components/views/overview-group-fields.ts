import type { DataFieldMap } from "@/constants/datafields/types";
import {
  formatOverviewValue,
  isOverviewValueAvailable,
} from "./overview-value-policy";

export interface OverviewGroupField {
  field: string;
  label: string;
  value: string;
}

export interface OverviewGroupFieldsOptions {
  fields: DataFieldMap;
  group: string;
  row: Record<string, unknown>;
  dateFields: ReadonlySet<string>;
  formatDate: (value: string) => string | null;
  exclude?: ReadonlySet<string>;
}

/**
 * A field is dropped when its formatted text is empty; the check is on text
 * because `[""]` is available but formats to nothing.
 */
export function overviewGroupFields({
  fields,
  group,
  row,
  dateFields,
  formatDate,
  exclude,
}: OverviewGroupFieldsOptions): OverviewGroupField[] {
  const collected: OverviewGroupField[] = [];
  for (const definition of Object.values(fields)) {
    const { field, label } = definition;
    if (definition.group !== group) continue;
    if (exclude?.has(field)) continue;
    const raw = row[field];
    const text =
      dateFields.has(field) && typeof raw === "string" && raw !== ""
        ? formatDate(raw)
        : isOverviewValueAvailable(raw)
          ? formatOverviewValue(raw)
          : null;
    if (!text) continue;
    collected.push({ field, label, value: text });
  }
  return collected;
}
