export interface ViewTypeEntry {
  segment: string;
  legacySingular?: string;
  legacySingularAliases?: readonly string[];
  legacyList?: string;
  legacyListAliases?: readonly string[];
  legacyListAliasParams?: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

export type ViewRegistry = Record<string, ViewTypeEntry>;

export function isViewSegment(value: string, registry: ViewRegistry): boolean {
  return Object.prototype.hasOwnProperty.call(registry, value);
}
