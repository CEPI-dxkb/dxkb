import {
  featureBrowserFocus,
  formatLocation,
  genomeDefaultLocation,
  isGenomeBrowserAnnotation,
  isGenomeBrowserTrackId,
  locationRefName,
  resolveInitialLocation,
} from "../contract";

const regions = [
  { refName: "470.36849.con.0001", start: 0, end: 305_802 },
  { refName: "470.36849.con.0002", start: 0, end: 50_000 },
];

describe("genome browser locations", () => {
  it("formats 1-based inclusive location strings", () => {
    expect(formatLocation("JX869059", 1, 100)).toBe("JX869059:1..100");
  });

  it("opens a genome on the first 100 kb of its longest sequence", () => {
    expect(genomeDefaultLocation(regions)).toBe(
      "470.36849.con.0001:1..100000",
    );
  });

  it("opens a sequence shorter than the window whole", () => {
    expect(
      genomeDefaultLocation([{ refName: "JX869059", start: 0, end: 30_119 }]),
    ).toBe("JX869059:1..30119");
  });

  it("has no default location for a genome without sequences", () => {
    expect(genomeDefaultLocation([])).toBeUndefined();
  });

  it("frames a feature with legacy's 3 kb flanks and highlights it", () => {
    expect(
      featureBrowserFocus({ accession: "ATGO01000001", start: 9610, end: 10707 }),
    ).toEqual({
      location: "ATGO01000001:6610..13707",
      highlight: "ATGO01000001:9610..10707",
    });
  });

  it("clamps the left flank at the start of the sequence", () => {
    expect(
      featureBrowserFocus({ accession: "JX869059", start: 1, end: 100 }),
    ).toEqual({ location: "JX869059:1..3100", highlight: "JX869059:1..100" });
  });

  it("accepts the Data API's string coordinates", () => {
    expect(
      featureBrowserFocus({ accession: "A", start: "5000", end: "5100" })
        ?.location,
    ).toBe("A:2000..8100");
  });

  it("has no focus without an accession or valid coordinates", () => {
    expect(featureBrowserFocus({ start: 1, end: 2 })).toBeNull();
    expect(featureBrowserFocus({ accession: "A", start: 10, end: 5 })).toBeNull();
    expect(featureBrowserFocus({ accession: "A", start: "x", end: 5 })).toBeNull();
  });

  it("reads the sequence name of a location", () => {
    expect(locationRefName("470.36849.con.0001:1..2")).toBe(
      "470.36849.con.0001",
    );
    expect(locationRefName("JX869059")).toBe("JX869059");
  });

  it("keeps a requested location on one of the genome's sequences", () => {
    expect(
      resolveInitialLocation("470.36849.con.0002:10..20", regions, "fallback"),
    ).toBe("470.36849.con.0002:10..20");
  });

  it("falls back when the requested sequence is not the genome's", () => {
    expect(resolveInitialLocation("other:1..2", regions, "fallback")).toBe(
      "fallback",
    );
    expect(resolveInitialLocation(undefined, regions, "fallback")).toBe(
      "fallback",
    );
  });

  it("accepts the coordinate forms JBrowse reads", () => {
    for (const location of [
      "470.36849.con.0001",
      "470.36849.con.0001:1,000..2,000",
      "470.36849.con.0001:1-100",
      "470.36849.con.0001:500..900",
    ]) {
      expect(resolveInitialLocation(location, regions, "fallback")).toBe(
        location,
      );
    }
  });

  it("falls back when the requested coordinates are malformed", () => {
    for (const location of [
      "470.36849.con.0001:abc",
      "470.36849.con.0001:1..",
      "470.36849.con.0001:..5",
      "470.36849.con.0001:1..5x",
      "470.36849.con.0001:,..,",
      "470.36849.con.0001:1..2..3",
      "470.36849.con.0001:",
    ]) {
      expect(resolveInitialLocation(location, regions, "fallback")).toBe(
        "fallback",
      );
    }
  });

  it("falls back when the requested range is reversed", () => {
    // JBrowse throws "found start greater than end" and opens a blank view.
    for (const location of [
      "470.36849.con.0001:500..100",
      "470.36849.con.0001:2,000..1,000",
      "470.36849.con.0001:20-10",
    ]) {
      expect(resolveInitialLocation(location, regions, "fallback")).toBe(
        "fallback",
      );
    }
    // Compared as numbers once the digit grouping is gone, not as text.
    for (const location of [
      "470.36849.con.0001:100..100",
      "470.36849.con.0001:9..10",
      "470.36849.con.0001:999..1,000",
    ]) {
      expect(resolveInitialLocation(location, regions, "fallback")).toBe(
        location,
      );
    }
  });

  it("knows the legacy track ids and the two annotations", () => {
    expect(isGenomeBrowserTrackId("PATRICGenes")).toBe(true);
    expect(isGenomeBrowserTrackId("genes")).toBe(false);
    expect(isGenomeBrowserAnnotation("RefSeq")).toBe(true);
    expect(isGenomeBrowserAnnotation("refseq")).toBe(false);
  });
});
