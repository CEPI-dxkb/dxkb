import { nonDeprecatedGenomeClause } from "@/lib/services/organisms/genome-scope";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

export type TaxonViewScope =
  | { kind: "lineage"; taxon: OrganismTaxonomy }
  | {
      kind: "composite";
      displayName: string;
      roots: readonly OrganismTaxonomy[];
    };

function lineageClause(taxon: OrganismTaxonomy): string {
  return `eq(taxon_lineage_ids,${String(taxon.taxonId)})`;
}

export function taxonLineageClause(scope: TaxonViewScope): string {
  const roots = scopeRoots(scope);
  if (scope.kind === "lineage") {
    return lineageClause(scope.taxon);
  }

  return `or(${roots.map(lineageClause).join(",")})`;
}

/** The scope's genomes as its Genomes tab lists them: none Deprecated. */
export function taxonGenomesClause(scope: TaxonViewScope): string {
  return `and(${taxonLineageClause(scope)},${nonDeprecatedGenomeClause})`;
}

export function scopeRoots(scope: TaxonViewScope): readonly OrganismTaxonomy[] {
  const roots = scope.kind === "lineage" ? [scope.taxon] : scope.roots;
  if (roots.length === 0) {
    throw new Error("Taxon view scopes must include at least one root taxon.");
  }
  return roots;
}
