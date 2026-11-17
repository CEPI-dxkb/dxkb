import { nonDeprecatedGenomeClause } from "@/lib/services/organisms/genome-scope";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

export type TaxonViewScope =
  | { kind: "lineage"; taxon: OrganismTaxonomy }
  | {
      kind: "composite";
      displayName: string;
      roots: readonly OrganismTaxonomy[];
    };

function lineageIdClause(taxonId: number): string {
  return `eq(taxon_lineage_ids,${String(taxonId)})`;
}

/**
 * The genomes under any of these taxa: a bare `eq` for one id, `or(...)` for
 * several. Taxon-id callers (an Overview that has no scope) and the scope-based
 * clauses below share it, so a landing page's charts and its Genomes tab cannot
 * disagree about what a root covers.
 */
export function taxonIdsLineageClause(taxonIds: readonly number[]): string {
  if (taxonIds.length === 0) {
    throw new Error("A taxon lineage clause needs at least one taxon id.");
  }
  const clauses = taxonIds.map(lineageIdClause);
  return clauses.length === 1 ? clauses[0] : `or(${clauses.join(",")})`;
}

/** The taxa's genomes as a Genomes tab lists them: none Deprecated. */
export function taxonIdsGenomesClause(taxonIds: readonly number[]): string {
  return `and(${taxonIdsLineageClause(taxonIds)},${nonDeprecatedGenomeClause})`;
}

export function taxonLineageClause(scope: TaxonViewScope): string {
  return taxonIdsLineageClause(
    scopeRoots(scope).map((root) => root.taxonId),
  );
}

/** The scope's genomes as its Genomes tab lists them: none Deprecated. */
export function taxonGenomesClause(scope: TaxonViewScope): string {
  return taxonIdsGenomesClause(scopeRoots(scope).map((root) => root.taxonId));
}

export function scopeRoots(scope: TaxonViewScope): readonly OrganismTaxonomy[] {
  const roots = scope.kind === "lineage" ? [scope.taxon] : scope.roots;
  if (roots.length === 0) {
    throw new Error("Taxon view scopes must include at least one root taxon.");
  }
  return roots;
}
