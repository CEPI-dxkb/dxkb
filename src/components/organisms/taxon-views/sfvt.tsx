import { LazyResourceChildCollection } from "./lazy-tab-roots";
import { sequenceFeatureColumns } from "@/lib/views/child-resources";
import type { TaxonViewScope } from "./scope";

// SFVT scopes with eq(taxon_id,…); features exist only at the curated species
// taxon_id, so a page taxon must resolve to it. Only add a `sfvtTaxonIdRemap` entry
// when the landing taxon id differs from the species id where features are stored.
export const sfvtTaxonIdRemap: Record<number, number> = {
  2955291: 11320,
};

// Matched against the full lineage; curated membership is required before an explicit
// remap, or curation could remove a cohort without hiding it. First hit wins.
export function resolveSfvtTaxonId(
  lineageIds: readonly number[],
  sfvtTaxonIds: ReadonlySet<number>,
): number | null {
  for (const id of lineageIds) {
    if (sfvtTaxonIds.has(id)) return sfvtTaxonIdRemap[id] ?? id;
  }
  return null;
}

export function makeSfvtView({
  scope,
  sfvtTaxonIds,
}: {
  scope: TaxonViewScope;
  sfvtTaxonIds: ReadonlySet<number>;
}) {
  function SfvtView() {
    const lineages = scope.kind === "composite"
      ? scope.roots.map((root) => root.lineageIds)
      : [scope.taxon.lineageIds];
    const taxonIds =
      scope.kind === "composite" && scope.roots.some((root) => root.taxonId === 10239)
        ? [...sfvtTaxonIds].map((id) => sfvtTaxonIdRemap[id] ?? id)
        : lineages
            .map((lineageIds) => resolveSfvtTaxonId(lineageIds, sfvtTaxonIds))
            .filter((id): id is number => id !== null);
    // Guard against gate and curation drift rendering the entire sequence_feature resource.
    if (taxonIds.length === 0) return null;
    const query = taxonIds.length === 1
      ? `eq(taxon_id,${String(taxonIds[0])})`
      : `in(taxon_id,(${taxonIds.join(",")}))`;
    return (
      <LazyResourceChildCollection
        urlKey="sfvt"
        resource="sequence_feature"
        label="Sequence Features"
        idField="id"
        rql={query}
        columns={sequenceFeatureColumns}
        defaultSort="sf_name:asc"
        guideUrl="https://www.bv-brc.org/docs/quick_references/organisms_taxon/sfvt.html"
      />
    );
  }
  return SfvtView;
}
