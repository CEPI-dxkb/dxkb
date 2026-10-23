import {
  defaultCompareRegionSettings,
  isCompareRegionLinkable,
  parseCompareRegionSettings,
} from "../contract";

function reader(values: Record<string, string>) {
  const entries = new Map(Object.entries(values));
  return (name: string) => entries.get(name) ?? null;
}

describe("Compare Region contract", () => {
  it("reads every setting, defaulting the missing ones", () => {
    expect(parseCompareRegionSettings(reader({}))).toEqual(
      defaultCompareRegionSettings,
    );
    expect(
      parseCompareRegionSettings(
        reader({ size: "50000", genomes: "20", method: "plfam", filter: "all" }),
      ),
    ).toEqual({ size: 50000, genomes: 20, method: "plfam", filter: "all" });
  });

  it("refuses a value the viewer does not offer", () => {
    expect(parseCompareRegionSettings(reader({ size: "12345" }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ genomes: "7" }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ method: "figfam" }))).toBeNull();
    // The service's own token is not ours: its "+" would read as a space.
    expect(
      parseCompareRegionSettings(reader({ filter: "representative+reference" })),
    ).toBeNull();
  });

  it("links only genes and RNAs, which have Feature Views", () => {
    expect(isCompareRegionLinkable("fig|1004954.3.peg.1")).toBe(true);
    expect(isCompareRegionLinkable("fig|254945.26.rna.14")).toBe(true);
    expect(isCompareRegionLinkable("fig|1004954.3.peg.1.BLAST")).toBe(false);
    expect(isCompareRegionLinkable("fig|1004954.3.pg.1")).toBe(false);
    expect(isCompareRegionLinkable("fig|155892.7.repeat.75")).toBe(false);
  });
});
