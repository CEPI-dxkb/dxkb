/**
 * Shape of a single data-field definition used across the `datafields/*` files.
 *
 * `field` is the canonical column identifier read by consumers
 * (`Object.values(fields).map((f) => f.field)` in `info-panel.tsx`). It is
 * intentionally distinct from the object key in some
 * entries — e.g. keys that cannot start with a digit (`s_1_pb2` → `1_pb2`) or
 * use short aliases (`m_value` → `measurement_value`). Do NOT derive `field`
 * from the key; the key is decorative and never read.
 */
export interface DataField {
  /** Human-readable column label. */
  label: string;
  /** Canonical column identifier sent to / read from the backend. */
  field: string;
  /** Whether the column is hidden by default in table views. */
  hidden: boolean;
  /** Display group / section the field belongs to. */
  group: string;
  /** Whether the field is available as a facet filter. */
  facet?: boolean;
  /** Whether the facet is hidden in the facet UI by default. */
  facet_hidden?: boolean;
  /** Whether the field participates in keyword search. */
  search?: boolean;
  /** Whether the field is shown as a table column (defaults to shown). */
  show_in_table?: boolean;
  /** Whether the column is sortable (defaults to sortable). */
  sortable?: boolean;
  /** URL template for rendering the value as a link; `{value}` / `{field}` are interpolated. */
  link?: string;
  /** Optional link rendering hint. */
  linkType?: string;
  /** Optional override text for the rendered link. */
  linkText?: string;
}

/** A keyed collection of {@link DataField} definitions, one per resource file. */
export type DataFieldMap = Record<string, DataField>;
