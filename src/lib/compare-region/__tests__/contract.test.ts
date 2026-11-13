import {
  compareRegionFilterLabels,
  compareRegionMethodShortLabels,
  defaultCompareRegionSettings,
  hasCompareRegionTab,
  isCompareRegionGroupFilter,
  isCompareRegionGroupPath,
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
    ).toEqual({
      size: 50000,
      genomes: 20,
      method: "plfam",
      filter: "all",
      group: null,
    });
  });

  it("refuses a value the viewer does not offer", () => {
    expect(parseCompareRegionSettings(reader({ size: "12345" }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ genomes: "7" }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ method: "figfam" }))).toBeNull();
    expect(
      parseCompareRegionSettings(reader({ filter: "representative+reference" })),
    ).toBeNull();
  });

  it("links every gene PATRIC names, not BLAST hits", () => {
    for (const fid of [
      "fig|1004954.3.peg.1",
      "fig|2697049.6703420.CDS.11",
      "fig|254945.26.rna.14",
      "fig|1004954.3.pg.1",
      "fig|155892.7.repeat.75",
      "fig|2697049.6699399.mat_peptide.10",
    ]) {
      expect(isCompareRegionLinkable(fid)).toBe(true);
    }
    expect(isCompareRegionLinkable("fig|1004954.3.peg.1.BLAST")).toBe(false);
    expect(isCompareRegionLinkable("not-a-fig-id")).toBe(false);
  });

  it.each([
    ["fig|1.1.peg.2", true],
    ["fig|2697049.6703420.CDS.11", true],
    ["fig|1.1.rna.3", true],
    ["fig|1.1.peg.2.BLAST", false],
  ])(
    "offers %s a comparison link and a feature link (%s): every PATRIC gene has the tab",
    (fid, offered) => {
      expect(hasCompareRegionTab(fid)).toBe(offered);
      expect(isCompareRegionLinkable(fid)).toBe(offered);
    },
  );

  it("names the sources as legacy BV-BRC does", () => {
    expect(compareRegionFilterLabels).toEqual({
      reference: "Reference & representative",
      all: "All genomes",
      genomeGroup: "Selected genome group",
      featureGroup: "Selected feature group",
    });
  });

  it("gives each method a short label for the command bar's toggle", () => {
    expect(compareRegionMethodShortLabels).toEqual({
      pgfam: "PGfam",
      plfam: "PLfam",
    });
  });
});

describe("Compare Region group filters", () => {
  const path = "/user@bvbrc/home/Genome Groups/My group";

  it("defaults to no group", () => {
    expect(defaultCompareRegionSettings.group).toBeNull();
  });

  it("reads a genome or feature group with its workspace path", () => {
    expect(parseCompareRegionSettings(reader({ filter: "genomeGroup", group: path }))).toEqual({
      ...defaultCompareRegionSettings,
      filter: "genomeGroup",
      group: path,
    });
    expect(
      parseCompareRegionSettings(reader({ filter: "featureGroup", group: path }))?.filter,
    ).toBe("featureGroup");
  });

  it("refuses a group filter without a usable path", () => {
    expect(parseCompareRegionSettings(reader({ filter: "genomeGroup" }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ filter: "genomeGroup", group: "" }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ filter: "featureGroup", group: "relative/path" }))).toBeNull();
    expect(
      parseCompareRegionSettings(reader({ filter: "genomeGroup", group: `/${"a".repeat(1024)}` })),
    ).toBeNull();
    expect(parseCompareRegionSettings(reader({ filter: "genomeGroup", group: "/a\nb" }))).toBeNull();
  });

  it("refuses a group on a filter that is not a group filter", () => {
    expect(parseCompareRegionSettings(reader({ filter: "all", group: path }))).toBeNull();
    expect(parseCompareRegionSettings(reader({ filter: "all", group: "" }))).toEqual({
      ...defaultCompareRegionSettings,
      filter: "all",
      group: null,
    });
  });

  it("tells group filters and paths apart", () => {
    expect(isCompareRegionGroupFilter("genomeGroup")).toBe(true);
    expect(isCompareRegionGroupFilter("featureGroup")).toBe(true);
    expect(isCompareRegionGroupFilter("reference")).toBe(false);
    expect(isCompareRegionGroupPath(path)).toBe(true);
    expect(isCompareRegionGroupPath(`/${"a".repeat(1023)}`)).toBe(true);
    expect(isCompareRegionGroupPath(`/${"a".repeat(1024)}`)).toBe(false);
  });
});
