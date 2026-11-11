import { getCuratedLists } from "@/lib/taxon-view/curated-lists";

import { resolveSfvtTaxonId, sfvtTaxonIdRemap } from "@/components/organisms/taxon-views/sfvt";

// Taxa in sfvtTaxonIds self-map; sfvtTaxonIdRemap holds only explicit overrides
// where the landing taxon id differs from the feature taxon id.
describe("sfvt taxon-id remap", () => {
  it("covers every curated SFVT taxon", () => {
    const { sfvtTaxonIds } = getCuratedLists();
    for (const id of sfvtTaxonIds) {
      expect(resolveSfvtTaxonId([id], sfvtTaxonIds)).not.toBeNull();
    }
  });

  it("self-maps a curated taxon with no explicit remap entry", () => {
    const sfvtTaxonIds = new Set([12637]);
    expect(resolveSfvtTaxonId([12637], sfvtTaxonIds)).toBe(12637);
  });

  it("resolves a taxon via any ancestor in its lineage", () => {
    const [curatedId] = Object.keys(sfvtTaxonIdRemap).map(Number);
    const sfvtTaxonIds = new Set([curatedId]);
    expect(resolveSfvtTaxonId([999, curatedId], sfvtTaxonIds)).toBe(
      sfvtTaxonIdRemap[curatedId],
    );
  });

  it("remaps the Influenza A landing taxon to the species id", () => {
    const { sfvtTaxonIds } = getCuratedLists();
    expect(resolveSfvtTaxonId([2955291], sfvtTaxonIds)).toBe(11320);
  });

  it("does not remap a taxon removed from the curated set", () => {
    expect(resolveSfvtTaxonId([2955291], new Set([12637]))).toBeNull();
  });

  it("returns null when no lineage id is curated", () => {
    const { sfvtTaxonIds } = getCuratedLists();
    expect(resolveSfvtTaxonId([1, 2, 999], sfvtTaxonIds)).toBeNull();
  });
});
