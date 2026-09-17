import type { DataFieldMap } from "@/constants/datafields/types";
import { formatOverviewValue, isOverviewValueAvailable } from "./overview-card";

/**
 * A field ready for `OverviewSection`, already reduced to display text.
 * Structurally a subset of `OverviewSectionField`, so the result of
 * {@link overviewGroupFields} can be handed straight to the section renderer.
 */
export interface OverviewGroupField {
  field: string;
  label: string;
  value: string;
}

export interface OverviewGroupFieldsOptions {
  /** The resource's `DataFieldMap`. Its iteration order sets display order. */
  fields: DataFieldMap;
  /** The `DataField.group` to collect. */
  group: string;
  /** The entity row to read values from. */
  row: Record<string, unknown>;
  /** Field IDs whose value is a source date rather than an ordinary value. */
  dateFields: ReadonlySet<string>;
  /** Formatter for the fields named in `dateFields`. */
  formatDate: (value: string) => string | null;
  /**
   * Field IDs to skip entirely — for a field the caller renders itself, such
   * as a latitude/longitude pair combined into one coordinates field.
   */
  exclude?: ReadonlySet<string>;
}

/**
 * Collect one `DataField.group`'s populated fields from a row, as display text.
 *
 * This is the shared half of the Serology and Surveillance overviews. Their
 * per-field `displayValue` branches were identical apart from the date
 * formatter they called, and the group `flatMap` around them was identical
 * outright. Four things differed, which is why four parameters join `group`
 * and `row`: the `DataFieldMap` each one read (`fields`), its own set of
 * date-valued field ids (`dateFields`), its formatter (`formatDate`), and
 * Surveillance's skip of `collection_latitude`/`collection_longitude`, which
 * it renders as a single combined field (`exclude`).
 *
 * It deliberately does **not** generalize to the static entity overviews
 * (Genome, Feature, Epitope, Experiment). Those order and format their fields
 * by hand, and this helper's whole premise is that display order comes from a
 * `DataFieldMap` instead.
 *
 * A field is dropped when it formats to no text: a date field with no usable
 * date, an unavailable value, or an available-but-empty formatting such as
 * `[""]`. That last case is why the check is on the formatted text rather than
 * on `isOverviewValueAvailable` alone.
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
