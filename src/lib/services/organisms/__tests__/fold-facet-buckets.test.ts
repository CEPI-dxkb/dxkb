import { foldFacetBuckets } from "@/lib/services/organisms/fold-facet-buckets";

describe("foldFacetBuckets", () => {
  it("merges case variants, sums counts and keeps the larger spelling", () => {
    expect(
      foldFacetBuckets([
        { name: "Nonhuman Mammal", count: 33861 },
        { name: "Nonhuman mammal", count: 1120 },
      ]),
    ).toEqual([{ name: "Nonhuman Mammal", count: 34981 }]);
  });

  it("keeps the first-returned spelling when variants tie", () => {
    expect(
      foldFacetBuckets([
        { name: "Soil", count: 5 },
        { name: "soil", count: 5 },
      ]),
    ).toEqual([{ name: "Soil", count: 10 }]);
  });

  it("takes the spelling with the larger count when it arrives after a smaller one", () => {
    expect(
      foldFacetBuckets([
        { name: "Nonhuman mammal", count: 5 },
        { name: "Nonhuman Mammal", count: 9 },
      ]),
    ).toEqual([{ name: "Nonhuman Mammal", count: 14 }]);
  });

  it("re-sorts by merged count so a merged bucket can outrank a larger single one", () => {
    expect(
      foldFacetBuckets([
        { name: "Avian", count: 60 },
        { name: "Nonhuman mammal", count: 50 },
        { name: "Nonhuman Mammal", count: 30 },
      ]),
    ).toEqual([
      { name: "Nonhuman mammal", count: 80 },
      { name: "Avian", count: 60 },
    ]);
  });

  it("keeps first-returned order between buckets with equal counts", () => {
    expect(
      foldFacetBuckets([
        { name: "Bat", count: 4 },
        { name: "Cat", count: 4 },
      ]),
    ).toEqual([
      { name: "Bat", count: 4 },
      { name: "Cat", count: 4 },
    ]);
  });

  it("trims and collapses whitespace in the name and in the group key", () => {
    expect(
      foldFacetBuckets([
        { name: "Longhorned tick ", count: 3 },
        { name: "longhorned  tick", count: 2 },
      ]),
    ).toEqual([{ name: "Longhorned tick", count: 5 }]);
  });

  it("merges blank and whitespace-only names into one blank bucket", () => {
    expect(
      foldFacetBuckets([
        { name: "", count: 8941 },
        { name: "  ", count: 9 },
      ]),
    ).toEqual([{ name: "", count: 8950 }]);
  });

  it("does not merge different words, so synonyms stay separate", () => {
    expect(
      foldFacetBuckets([
        { name: "Nasal swab", count: 10 },
        { name: "Nasal", count: 4 },
        { name: "Nasal swabs", count: 3 },
      ]),
    ).toEqual([
      { name: "Nasal swab", count: 10 },
      { name: "Nasal", count: 4 },
      { name: "Nasal swabs", count: 3 },
    ]);
  });

  it("does not mutate its input", () => {
    const input = [
      { name: "Human", count: 2 },
      { name: "human", count: 1 },
    ];
    foldFacetBuckets(input);
    expect(input).toEqual([
      { name: "Human", count: 2 },
      { name: "human", count: 1 },
    ]);
  });
});
