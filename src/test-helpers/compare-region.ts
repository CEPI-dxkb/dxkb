import type {
  CompareRegionFeature,
  CompareRegionRow,
} from "@/lib/compare-region/contract";

export function testGene(
  fid: string,
  start: number,
  end: number,
  overrides: Partial<CompareRegionFeature> = {},
): CompareRegionFeature {
  return {
    fid,
    type: "peg",
    start,
    end,
    strand: start <= end ? "+" : "-",
    product: "hypothetical protein",
    family: null,
    familyId: null,
    identity: null,
    ...overrides,
  };
}

/**
 * The focus gene's row: plus strand, centered at 1000 over a 2 kb window.
 * Its features are, by index (the layout keeps this order): 0 the upstream
 * gene, 1 the focus gene, 2 the focus gene's BLAST hit (lane 1).
 */
export const focusRow: CompareRegionRow = {
  genomeId: "1.1",
  genomeName: "Escherichia coli str. K-12 substr. MG1655",
  start: 0,
  end: 2000,
  contigLength: 5000,
  pinnedFid: "fig|1.1.peg.2",
  pinnedStrand: "+",
  center: 1000,
  features: [
    testGene("fig|1.1.peg.1", 100, 400, {
      family: 3,
      familyId: "PGF_00000003",
      product: "Upstream protein",
    }),
    testGene("fig|1.1.peg.2", 900, 1200, {
      family: 1,
      familyId: "PGF_00000001",
      identity: 100,
      product: "Focus protein",
    }),
    testGene("fig|1.1.peg.2.BLAST", 900, 1200, {
      type: "blast",
      strand: null,
      identity: 100,
      product: "blast hit for pin",
    }),
  ],
};

/**
 * A homolog on the minus strand, so its row is mirrored. Its window runs past
 * the end of its contig.
 */
export const mirroredRow: CompareRegionRow = {
  genomeId: "2.1",
  genomeName: "Salmonella enterica",
  start: 4000,
  end: 6000,
  contigLength: 5500,
  pinnedFid: "fig|2.1.peg.7",
  pinnedStrand: "-",
  center: 5000,
  features: [
    testGene("fig|2.1.peg.7", 5100, 4800, {
      family: 1,
      identity: 80,
      product: "Focus homolog",
    }),
  ],
};
