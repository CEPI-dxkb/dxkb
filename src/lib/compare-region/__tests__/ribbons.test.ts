import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import type { CompareRegionFeature, CompareRegionRow } from "../contract";
import { densitySpecs } from "../density";
import {
  bridgeRibbons,
  buildChartModel,
  type ChartModel,
  type Ribbon,
} from "../families";
import {
  connectorAlpha,
  connectorFade,
  connectorPath,
  restingRibbons,
  ribbonAlpha,
  ribbonKey,
  ribbonMinRows,
  ribbonPath,
} from "../ribbons";
import { trackScale, type TrackMatrix } from "../ruler";
import rows10 from "./fixtures/rows-10.json";
import rows50 from "./fixtures/rows-50.json";

const { comfortable, compact } = densitySpecs;
const plotWidth = 674;
const identity: TrackMatrix = { scaleX: 1, translateX: 0 };

function familyRibbon(model: ChartModel, family: number): Ribbon {
  const ribbon = model.families.ribbons.find((item) => item.family === family);
  if (!ribbon) throw new Error(`No ribbon for family ${String(family)}`);
  return ribbon;
}

describe("ribbonMinRows", () => {
  it.each([
    [1, 10, 5],
    [1.5, 10, 4],
    [2, 10, 3],
    [3, 10, 2],
    [0.5, 10, 5],
    [1, 20, 10],
    [1.5, 20, 7],
    [2, 20, 5],
    [3, 20, 4],
    [3.375, 20, 3],
    [5, 20, 2],
    [1, 50, 25],
    [2, 50, 13],
    [5, 50, 5],
    [10, 50, 3],
    [20, 50, 2],
    [1, 1, 2],
  ])("at %s× over %i genomes asks for %i", (zoom, rowTotal, expected) => {
    expect(ribbonMinRows(zoom, rowTotal)).toBe(expected);
  });
});

describe("resting opacity", () => {
  it.each([
    [0.5, 0.12],
    [1, 0.12],
    [1.5, 0.145],
    [2, 0.163],
    [2.25, 0.17],
    [3.375, 0.196],
    [5, 0.22],
    [20, 0.22],
  ])("draws bands at %s× at %s", (zoom, alpha) => {
    expect(ribbonAlpha(zoom)).toBe(alpha);
  });

  it.each([
    [1, 0.5],
    [1.5, 0.55],
    [2, 0.586],
    [2.25, 0.601],
    [3.375, 0.651],
    [5, 0.7],
    [20, 0.7],
  ])("draws connectors at %s× at %s", (zoom, alpha) => {
    expect(connectorAlpha(zoom)).toBe(alpha);
  });
});

describe("connectorFade", () => {
  it.each([
    [0, 1],
    [48, 1],
    [100, 0.896],
    [298, 0.5],
    [373, 0.35],
    [1000, 0.35],
  ])("fades a connector reaching %s px sideways to %s", (reach, fade) => {
    expect(connectorFade(reach)).toBeCloseTo(fade, 10);
  });

  it("halves a 298 px connector's 1× opacity to 0.25", () => {
    expect(Math.round(connectorAlpha(1) * connectorFade(298) * 100) / 100).toBe(
      0.25,
    );
  });
});

describe("restingRibbons", () => {
  /** Ten genomes: family 20 in the first five, family 30 in the next four. */
  const rows = Array.from({ length: 10 }, (_, index): CompareRegionRow => {
    const id = `${String(index + 1)}.1`;
    const features: CompareRegionFeature[] = [
      testGene(`fig|${id}.peg.1`, 900, 1200, { family: 1 }),
    ];
    if (index < 5) {
      features.push(testGene(`fig|${id}.peg.2`, 1400, 1700, { family: 20 }));
    } else if (index < 9) {
      features.push(testGene(`fig|${id}.peg.3`, 200, 500, { family: 30 }));
    }
    return {
      genomeId: id,
      genomeName: `Genome ${id}`,
      start: 0,
      end: 2000,
      contigLength: null,
      pinnedFid: `fig|${id}.peg.1`,
      pinnedStrand: "+",
      center: 1000,
      features,
    };
  });
  const model = buildChartModel(rows, comfortable);
  const families = (zoom: number) =>
    restingRibbons(model, zoom).map((ribbon) => ribbon.family);

  it("shows a family in half the genomes at 1×, and one in four from 1.5×", () => {
    expect(families(1)).toEqual([20, 20, 20, 20]);
    expect(families(1.5)).toEqual([20, 20, 20, 20, 30, 30, 30]);
  });

  it("shows none for the focus gene and its homolog, which share only the focus family", () => {
    const pair = buildChartModel([focusRow, mirroredRow], comfortable);
    expect(pair.families.ribbons).toHaveLength(1);
    expect(restingRibbons(pair, 1)).toEqual([]);
  });

  it("never shows the focus family, whose genes stack on the focus line", () => {
    expect(model.families.ribbonsByFamily.get(1)).toHaveLength(9);
    expect(families(20)).not.toContain(1);
  });

  it.each([
    [1, 12],
    [1.5, 16],
    [2.25, 28],
    [3.375, 30],
    [5, 30],
    [20, 30],
  ])(
    "shows %s× of the 10-genome answer as %i of its 39 ribbons",
    (zoom, shown) => {
      const answer = buildChartModel(
        rows10.rows as CompareRegionRow[],
        comfortable,
      );
      expect(answer.families.ribbons).toHaveLength(39);
      expect(restingRibbons(answer, zoom)).toHaveLength(shown);
    },
  );

  it("shows none of the 50-genome answer at 1×", () => {
    const answer = buildChartModel(
      rows50.rows as CompareRegionRow[],
      comfortable,
    );
    expect(restingRibbons(answer, 1)).toEqual([]);
  });
});

describe("ribbonPath and connectorPath", () => {
  const model = buildChartModel([focusRow, mirroredRow], comfortable);
  const x = trackScale(model.layout.domain, identity, plotWidth);

  it("joins a gene's bottom edge to its homolog's top edge with a band", () => {
    expect(
      ribbonPath(
        comfortable,
        model.layout,
        model.frame,
        familyRibbon(model, 1),
        x,
        plotWidth,
      ),
    ).toBe(
      "M303.3,62.5C303.3,80 303.3,80 303.3,97.5L404.4,97.5C404.4,80 404.4,80 404.4,62.5Z",
    );
  });

  it("twists the band into a bow tie when the genes point opposite ways", () => {
    const inverted = buildChartModel(
      [
        focusRow,
        {
          ...focusRow,
          genomeId: "3.1",
          features: [
            focusRow.features[1],
            testGene("fig|3.1.peg.4", 400, 100, { family: 3 }),
          ],
        },
      ],
      comfortable,
    );
    const ribbon = familyRibbon(inverted, 3);
    expect(
      ribbonPath(
        comfortable,
        inverted.layout,
        inverted.frame,
        ribbon,
        x,
        plotWidth,
      ),
    ).toBe(
      "M33.7,62.5C33.7,80 134.8,80 134.8,97.5L33.7,97.5C33.7,80 134.8,80 134.8,62.5Z",
    );
  });

  /** Family 3 moved: 100–400 in the focus row, 1500–1800 below it. */
  const movedRows: CompareRegionRow[] = [
    focusRow,
    {
      ...focusRow,
      genomeId: "3.1",
      features: [
        focusRow.features[1],
        testGene("fig|3.1.peg.4", 1500, 1800, { family: 3 }),
      ],
    },
  ];

  it("draws a connector as one center line, with its sideways reach", () => {
    const moved = buildChartModel(movedRows, comfortable);
    const connector = connectorPath(
      comfortable,
      moved.layout,
      moved.frame,
      familyRibbon(moved, 3),
      x,
      plotWidth,
    );
    expect(connector?.d).toBe("M84.3,62.5C84.3,80 556.1,80 556.1,97.5");
    expect(connector?.reach).toBeCloseTo(471.8, 6);
    expect(
      connectorPath(
        comfortable,
        model.layout,
        model.frame,
        familyRibbon(model, 1),
        x,
        plotWidth,
      )?.reach,
    ).toBeCloseTo(0, 10);
  });

  it("draws Compact's connector between its slimmer rows", () => {
    const moved = buildChartModel(movedRows, compact);
    const connector = connectorPath(
      compact,
      moved.layout,
      moved.frame,
      familyRibbon(moved, 3),
      x,
      plotWidth,
    );
    expect(connector?.d).toBe("M84.3,51.5C84.3,62 556.1,62 556.1,72.5");
    expect(connector && connectorFade(connector.reach)).toBe(0.35);
  });

  it.each([
    ["left", -5000],
    ["right", 5000],
  ])(
    "draws nothing for a ribbon wholly off the %s of the plot",
    (_, translateX) => {
      const away = trackScale(
        model.layout.domain,
        { scaleX: 1, translateX },
        plotWidth,
      );
      const ribbon = familyRibbon(model, 1);
      expect(
        ribbonPath(
          comfortable,
          model.layout,
          model.frame,
          ribbon,
          away,
          plotWidth,
        ),
      ).toBeNull();
      expect(
        connectorPath(
          comfortable,
          model.layout,
          model.frame,
          ribbon,
          away,
          plotWidth,
        ),
      ).toBeNull();
    },
  );

  it("draws a ribbon off the plot within the reach a drag draws past it", () => {
    // 600 px left: the focus genes span −297 to −196, inside a 674 px reach.
    const away = trackScale(
      model.layout.domain,
      { scaleX: 1, translateX: -600 },
      plotWidth,
    );
    const ribbon = familyRibbon(model, 1);
    const path = (reach?: number) =>
      ribbonPath(
        comfortable,
        model.layout,
        model.frame,
        ribbon,
        away,
        plotWidth,
        reach,
      );
    expect(path()).toBeNull();
    expect(path(150)).toBeNull();
    expect(path(plotWidth)).toBe(
      "M-296.7,62.5C-296.7,80 -296.7,80 -296.7,97.5L-195.6,97.5C-195.6,80 -195.6,80 -195.6,62.5Z",
    );
    expect(
      connectorPath(
        comfortable,
        model.layout,
        model.frame,
        ribbon,
        away,
        plotWidth,
        plotWidth,
      ),
    ).not.toBeNull();
  });
});

describe("ribbonKey", () => {
  const answer = buildChartModel(
    rows10.rows as CompareRegionRow[],
    comfortable,
  );

  it("names the family and both genes", () => {
    expect(
      ribbonKey({
        family: 3,
        upper: { rowIndex: 0, featureIndex: 4 },
        lower: { rowIndex: 1, featureIndex: 2 },
      }),
    ).toBe("3:0:4:1:2");
  });

  it("keys every ribbon of the 10-genome answer apart", () => {
    const keys = answer.families.ribbons.map(ribbonKey);
    expect(keys).toHaveLength(39);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keys a two-copy family's ribbons apart, each copy joined to both", () => {
    const copies = (genomeId: string) => [
      focusRow.features[1],
      testGene(`fig|${genomeId}.peg.8`, 1300, 1500, { family: 5 }),
      testGene(`fig|${genomeId}.peg.9`, 1600, 1800, { family: 5 }),
    ];
    const twoCopies = buildChartModel(
      [
        { ...focusRow, features: copies("1.1") },
        { ...focusRow, genomeId: "3.1", features: copies("3.1") },
      ],
      comfortable,
    );
    const keys = twoCopies.families.ribbons
      .filter((ribbon) => ribbon.family === 5)
      .map(ribbonKey);
    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
  });

  it("keys every family's bridges apart", () => {
    const bridges = [...answer.families.members.keys()].flatMap((family) =>
      bridgeRibbons(answer.layout, answer.families, family),
    );
    expect(bridges.length).toBeGreaterThan(0);
    const keys = bridges.map(ribbonKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
