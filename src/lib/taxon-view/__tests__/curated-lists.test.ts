import { getCuratedLists } from "../curated-lists";

describe("getCuratedLists", () => {
  it("returns Sets for each curated cohort", () => {
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds).toBeInstanceOf(Set);
    expect(lists.surveillanceLineageNames).toBeInstanceOf(Set);
    expect(lists.serologyLineageNames).toBeInstanceOf(Set);
  });

  it("seeds surveillance + serology with the documented influenza/rhinovirus names", () => {
    const lists = getCuratedLists();
    expect(lists.surveillanceLineageNames.has("Alphainfluenzavirus influenzae")).toBe(true);
    expect(lists.surveillanceLineageNames.has("Rhinovirus A")).toBe(true);
    expect(lists.serologyLineageNames.has("Alphainfluenzavirus influenzae")).toBe(true);
    expect(lists.serologyLineageNames.has("Rhinovirus A")).toBe(true);
  });

  it("seeds SFVT taxon ids observed in the source doc truth table", () => {
    const lists = getCuratedLists();
    expect(lists.sfvtTaxonIds.has(12637)).toBe(true);
    expect(lists.sfvtTaxonIds.has(10244)).toBe(true);
  });
});
