/** How a singular entity id is validated before fetch. "none" = id-less (protein-structure). */
export type IdKind = "int" | "string" | "none";

export interface SingularSpec {
  /** Dynamic route folder name, e.g. "genomeId" → app/(views)/genome/[genomeId]. */
  idParam: string;
  idKind: IdKind;
  /** Tab used when ?tab= is absent. */
  defaultTab: string;
}

export interface ListSpec {
  /** BV-BRC data endpoint name, e.g. "genome". */
  endpoint: string;
  /** Tab used when ?tab= is absent (differs from singular default per legacy doc). */
  defaultTab: string;
  /** Friendly query param names accepted and translated to RQL. */
  friendlyParams: readonly string[];
}

export interface ViewTypeEntry {
  /** Route folder + URL identity (lowercase kebab). */
  segment: string;
  label: string;
  /** Legacy BV-BRC singular view name, e.g. "Genome" (redirect source). */
  legacySingular?: string;
  /** Additional confirmed legacy singular names for the same canonical route. */
  legacySingularAliases?: readonly string[];
  /** Legacy BV-BRC list view name, e.g. "GenomeList" (redirect source). */
  legacyList?: string;
  /** Additional confirmed legacy list names for the same canonical route. */
  legacyListAliases?: readonly string[];
  /** Query parameters added when redirecting a specific legacy list alias. */
  legacyListAliasParams?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** searchtype id from constants/searchInfo.ts (for the deferred search repoint). */
  searchType?: string;
  /** Omitted => list-only type (for example, strain and domains-and-motifs). */
  singular?: SingularSpec;
  list: ListSpec;
}

export type ViewRegistry = Record<string, ViewTypeEntry>;

export function isViewSegment(value: string, registry: ViewRegistry): boolean {
  return Object.prototype.hasOwnProperty.call(registry, value);
}
