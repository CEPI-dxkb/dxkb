export interface ViewTypeEntry {
  /** Route folder + URL identity (lowercase kebab). */
  segment: string;
  /** Legacy BV-BRC singular view name, e.g. "Genome" (redirect source). */
  legacySingular?: string;
  /** Additional confirmed legacy singular names for the same canonical route. */
  legacySingularAliases?: readonly string[];
  /** Legacy BV-BRC list view name, e.g. "GenomeList" (redirect source). */
  legacyList?: string;
  /** Additional confirmed legacy list names for the same canonical route. */
  legacyListAliases?: readonly string[];
  /** Query parameters added when redirecting a specific legacy list alias. */
  legacyListAliasParams?: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

export type ViewRegistry = Record<string, ViewTypeEntry>;

export function isViewSegment(value: string, registry: ViewRegistry): boolean {
  return Object.prototype.hasOwnProperty.call(registry, value);
}
