import { ResourceChildCollection } from "@/components/views";
import { sequenceFeatureColumns } from "@/lib/views/child-resources";
import type { TaxonViewScope } from "./scope";

// SFVT reads the `sequence_feature` core, which has a taxon_id field, and scopes
// with eq(taxon_id,…) — same as legacy SFVTGrid. Features are stored only at the
// curated species taxon_id (sub-species/strain leaves have zero rows), so a page
// taxon must resolve to its curated species id.
//
// Most curated taxa map to themselves — those come from `sfvtTaxonIds` in
// getCuratedLists() automatically. Only add an entry to `sfvtTaxonIdRemap` when
// the landing taxon id differs from the species id where features are stored.
// Verified counts (2026-07-17) via eq(taxon_id,<mapped>): Dengue 7630,
// Monkeypox 1781, Influenza A 5696.
export const sfvtTaxonIdRemap: Record<number, number> = {
  2955291: 11320, // Alphainfluenzavirus influenzae → Influenza A virus species
};

// Match against the full lineage (not just taxonId) so a species/strain under a
// curated taxon resolves to its ancestor's mapped id — mirrors how `hasSfvt`
// gates on lineageIds. Curated membership is required before applying an explicit
// remap; otherwise the curation policy could remove a cohort without hiding it.
// First lineage hit wins.
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
    // Match hasSfvt's aggregate-root exception for the all-viruses scope.
    const taxonIds =
      scope.kind === "composite" && scope.roots.some((root) => root.taxonId === 10239)
        ? [...sfvtTaxonIds].map((id) => sfvtTaxonIdRemap[id] ?? id)
        : lineages
            .map((lineageIds) => resolveSfvtTaxonId(lineageIds, sfvtTaxonIds))
            .filter((id): id is number => id !== null);
    // The tab gate normally guarantees at least one ID. Keep the guard so gate
    // and curation drift cannot render the entire sequence_feature resource.
    if (taxonIds.length === 0) return null;
    const query = taxonIds.length === 1
      ? `eq(taxon_id,${String(taxonIds[0])})`
      : `in(taxon_id,(${taxonIds.join(",")}))`;
    return (
      <ResourceChildCollection
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
