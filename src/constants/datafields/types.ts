/** `field` is the canonical column identifier; it can differ from the object key, so never derive it from the key. */
export interface DataField {
  label: string;
  field: string;
  hidden: boolean;
  group: string;
  facet?: boolean;
  facet_hidden?: boolean;
  search?: boolean;
  show_in_table?: boolean;
  sortable?: boolean;
  /** URL template for rendering the value as a link; `{value}` / `{field}` are interpolated. */
  link?: string;
  linkType?: string;
  linkText?: string;
}

export type DataFieldMap = Record<string, DataField>;
