import type { CircularContig, CircularFeature } from "../contract";
import type { HoverItem } from "../drawing";
import { itemAnnouncement, itemFields, itemTitle } from "../item-fields";

const feature: CircularFeature = {
  featureId: "PATRIC.83332.12.NC_000962.CDS.1",
  accession: "NC_000962",
  start: 10,
  end: 99,
  strand: "+",
  featureType: "CDS",
  patricId: "fig|83332.12.peg.1",
  product: "Chromosomal replication initiator",
  gene: "dnaA",
  refseqLocusTag: "Rv0001",
  proteinId: "NP_214515.1",
  naLength: 1500,
  aaLength: 499,
};
const contig: CircularContig = {
  accession: "NC_000962",
  sequenceId: "seq-1",
  length: 4411532,
  gcContent: 65.6,
  topology: "circular",
  sequenceType: "chromosome",
};
const featureItem: HoverItem = { kind: "feature", feature };
const contigItem: HoverItem = { kind: "contig", contig };
const regionItem: HoverItem = {
  kind: "region",
  region: { accession: "R1", start: 5, end: 20, score: 3 },
};
const scoreItem: HoverItem = {
  kind: "score",
  point: { accession: "S1", start: 0, end: 100, score: 0.5 },
};

describe("itemTitle", () => {
  it("names a feature by PATRIC id, else its feature id", () => {
    expect(itemTitle(featureItem)).toBe("fig|83332.12.peg.1");
    expect(
      itemTitle({
        kind: "feature",
        feature: { ...feature, patricId: undefined },
      }),
    ).toBe(feature.featureId);
  });

  it("names a contig, region or score by its accession", () => {
    expect(itemTitle(contigItem)).toBe("NC_000962");
    expect(itemTitle(regionItem)).toBe("R1");
    expect(itemTitle(scoreItem)).toBe("S1");
  });
});

describe("itemFields", () => {
  it("gives a feature's short set, with the strand in the location", () => {
    expect(itemFields(featureItem, false)).toEqual([
      ["Product", "Chromosomal replication initiator"],
      ["Gene", "dnaA"],
      ["Type", "CDS"],
      ["Location", "NC_000962:10..99 (+)"],
    ]);
  });

  it("adds a feature's lengths and ids when full", () => {
    expect(itemFields(featureItem, true).slice(4)).toEqual([
      ["Length", "1,500 bp"],
      ["Protein length", "499 aa"],
      ["RefSeq locus tag", "Rv0001"],
      ["Protein ID", "NP_214515.1"],
      ["Feature ID", feature.featureId],
    ]);
  });

  it("leaves out empty values and a missing strand", () => {
    const sparse: HoverItem = {
      kind: "feature",
      feature: {
        featureId: "f1",
        accession: "A",
        start: 1,
        end: 2,
        strand: null,
        featureType: "gene",
        product: "",
      },
    };
    expect(itemFields(sparse, true)).toEqual([
      ["Type", "gene"],
      ["Location", "A:1..2"],
      ["Feature ID", "f1"],
    ]);
  });

  it("gives a contig's set, and its sequence id when full", () => {
    expect(itemFields(contigItem, false)).toEqual([
      ["Length", "4,411,532 bp"],
      ["GC content", "65.6%"],
      ["Topology", "circular"],
      ["Sequence type", "chromosome"],
    ]);
    expect(itemFields(contigItem, true).at(-1)).toEqual([
      "Sequence ID",
      "seq-1",
    ]);
    expect(
      itemFields(
        { kind: "contig", contig: { ...contig, gcContent: undefined } },
        false,
      ).map(([label]) => label),
    ).not.toContain("GC content");
  });

  it("gives a region's span and score, omitting a null score", () => {
    expect(itemFields(regionItem, false)).toEqual([
      ["Start", "5"],
      ["End", "20"],
      ["Score", "3"],
    ]);
    expect(
      itemFields(
        {
          kind: "region",
          region: { accession: "R1", start: 5, end: 20, score: null },
        },
        true,
      ),
    ).toEqual([
      ["Start", "5"],
      ["End", "20"],
    ]);
  });

  it("shows a score point's start one-based", () => {
    expect(itemFields(scoreItem, true)).toEqual([
      ["Start", "1"],
      ["End", "100"],
      ["Score", "0.5"],
    ]);
  });
});

describe("itemAnnouncement", () => {
  it("reads the track, place, title and short fields", () => {
    expect(
      itemAnnouncement({
        title: "Genes",
        position: 0,
        count: 3,
        item: regionItem,
      }),
    ).toBe("Genes, 1 of 3: R1. Start: 5. End: 20. Score: 3.");
  });
});
