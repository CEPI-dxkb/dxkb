import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { familyColor, labelInk } from "@/lib/compare-region/colors";
import type { CompareRegionRow } from "@/lib/compare-region/contract";
import { densitySpecs } from "@/lib/compare-region/density";
import {
  buildChartModel,
  focusMembers,
  type FeatureRef,
} from "@/lib/compare-region/families";
import { glyphBox } from "@/lib/compare-region/figure-frame";
import { capHeight } from "@/lib/compare-region/genome-labels";
import { glyphPath } from "@/lib/compare-region/glyph-paths";
import { trackScale, type TrackMatrix } from "@/lib/compare-region/ruler";
import { estimateTextWidth } from "@/lib/compare-region/text-measure";
import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import { GlyphLayer } from "../compare-region-glyphs";
import {
  HighlightLayer,
  HoverContext,
  LabelHighlight,
  PinContext,
  RowHoverContext,
  TraceVeil,
} from "../compare-region-highlight";
import {
  IdentityInfo,
  LabelColumn,
  LabelHeader,
} from "../compare-region-label-column";
import { Legend } from "../compare-region-legend";
import { CompareRegionTooltip } from "../compare-region-tooltip";
import {
  Baselines,
  FocusLine,
  RibbonLayer,
  RowTint,
  RulerAxis,
  TrackBands,
} from "../compare-region-track-layers";

/** D6: the focus family's fixed DXKB orange, in every theme. */
const focusOrange = "oklch(71.57% 0.182 37.18)";
/** The "focus" text: that orange 20 points darker, so it reads as text. */
const focusTextOrange = "oklch(51.57% 0.182 37.18)";
/** A 674 px plot: Comfortable's in a 912 px card, beside its 238 px label column. */
const plotWidth = 674;
const identity: TrackMatrix = { scaleX: 1, translateX: 0 };
/** 4×, about the focus line (x 337), so the ruler shows ±250 bp. */
const fourFold: TrackMatrix = { scaleX: 4, translateX: -1011 };
const measure = estimateTextWidth;

const rows = [focusRow, mirroredRow];
const comfortable = buildChartModel(rows, densitySpecs.comfortable);
const compact = buildChartModel(rows, densitySpecs.compact);

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

/**
 * A third genome whose window starts 200 bp before its contig, with one
 * glyph of each kind the first two rows lack. By index: 0 an orphan gene (in
 * no family), 1 the focus homolog, 2 a pseudogene in a family seen in this
 * genome only, 3 a pseudogene in no family, 4 a tRNA.
 */
const mixedRow: CompareRegionRow = {
  genomeId: "4.1",
  genomeName: "Bacillus subtilis subsp. subtilis str. 168",
  start: -200,
  end: 1800,
  contigLength: 4200,
  pinnedFid: "fig|4.1.peg.2",
  pinnedStrand: "+",
  center: 800,
  features: [
    testGene("fig|4.1.peg.1", 10, 300),
    testGene("fig|4.1.peg.2", 700, 1000, {
      family: 1,
      identity: 70,
      product: "Focus homolog",
    }),
    testGene("fig|4.1.peg.3", 1100, 1300, { type: "pseudogene", family: 4 }),
    testGene("fig|4.1.peg.4", 1350, 1450, { type: "pseudogene" }),
    testGene("fig|4.1.rna.5", 1500, 1600, { type: "rna", product: "tRNA-Ala" }),
  ],
};
const mixed = buildChartModel(
  [focusRow, mirroredRow, mixedRow],
  densitySpecs.comfortable,
);

function renderInSvg(children: ReactNode) {
  return render(<svg>{children}</svg>);
}

function tracedTree(
  hovered: FeatureRef | undefined,
  selected: FeatureRef | null,
  children: ReactNode,
) {
  return (
    <svg>
      <PinContext value={selected}>
        <HoverContext value={hovered}>{children}</HoverContext>
      </PinContext>
    </svg>
  );
}

function traced(
  hovered: FeatureRef | undefined,
  selected: FeatureRef | null,
  children: ReactNode,
) {
  return render(tracedTree(hovered, selected, children));
}

function glyphAt(
  container: HTMLElement,
  rowIndex: number,
  featureIndex: number,
) {
  return container.querySelector(
    `[data-row="${String(rowIndex)}"][data-feature="${String(featureIndex)}"]`,
  );
}

describe("GlyphLayer", () => {
  it("marks every glyph with its row and feature for the pointer", () => {
    const { container } = renderInSvg(
      <GlyphLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        pressed={null}
        measure={measure}
      />,
    );
    const marks = [...container.querySelectorAll("[data-feature]")].map(
      (node) => [
        node.getAttribute("data-row"),
        node.getAttribute("data-feature"),
      ],
    );
    expect(marks).toEqual([
      ["0", "0"],
      ["0", "1"],
      ["0", "2"],
      ["1", "0"],
    ]);
  });

  it("fills the focus family with the fixed focus orange, edged a shade darker when pinned", () => {
    const { container } = renderInSvg(
      <GlyphLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        pressed={null}
        measure={measure}
      />,
    );
    for (const glyph of [glyphAt(container, 0, 1), glyphAt(container, 1, 0)]) {
      expect(glyph).toHaveAttribute("fill", focusOrange);
      expect(glyph).toHaveAttribute("stroke", "oklch(0.516 0.182 37.18)");
    }
    expect(glyphAt(container, 0, 0)).toHaveAttribute("fill", familyColor(3));
  });

  it("labels the genes whose product fits whole, and no other", () => {
    renderInSvg(
      <GlyphLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        pressed={null}
        measure={measure}
      />,
    );
    expect(screen.getByText("Focus protein")).toHaveAttribute(
      "fill",
      "oklch(0.25 0.03 265)",
    );
    expect(screen.getByText("Focus homolog")).toBeInTheDocument();
    expect(screen.queryByText("Upstream protein")).not.toBeInTheDocument();
  });

  it("inks a quiet label on a fill fully, and one off a fill in the foreground", () => {
    const [upstream, focusGene, blast] = focusRow.features;
    const quiet = buildChartModel(
      [
        {
          ...focusRow,
          features: [
            upstream,
            { ...focusGene, product: "hypothetical protein" },
            blast,
            testGene("fig|1.1.peg.3", 760, 860, { product: "Orphan" }),
          ],
        },
        mirroredRow,
      ],
      densitySpecs.comfortable,
    );
    renderInSvg(
      <GlyphLayer
        model={quiet}
        matrix={fourFold}
        plotWidth={plotWidth}
        reach={0}
        pressed={null}
        measure={measure}
      />,
    );
    // Any lighter ink falls under 4.5:1 on the darker family fills.
    const onFill = screen.getByText("hypothetical protein");
    expect(onFill).toHaveAttribute("fill", labelInk);
    expect(onFill).not.toHaveAttribute("fill-opacity");
    expect(onFill).toHaveClass("italic");
    const offFill = screen.getByText("Orphan");
    expect(offFill).toHaveClass("fill-foreground");
    expect(offFill).not.toHaveClass("fill-foreground/75");
  });

  it("skips glyphs more than its reach off the plot, never the pressed one", () => {
    const layer = (reach: number, pressed: FeatureRef | null = null) => (
      <GlyphLayer
        model={comfortable}
        matrix={fourFold}
        plotWidth={plotWidth}
        reach={reach}
        pressed={pressed}
        measure={measure}
      />
    );
    // 4×: the upstream gene lies 472 px left of the plot.
    const atRest = renderInSvg(layer(0));
    expect(glyphAt(atRest.container, 0, 0)).toBeNull();
    expect(glyphAt(atRest.container, 0, 1)).not.toBeNull();
    atRest.unmount();

    const nearer = renderInSvg(layer(400));
    expect(glyphAt(nearer.container, 0, 0)).toBeNull();
    nearer.unmount();

    // While a drag pans, a plot's width past the edge: drawn, and labelled in
    // its whole body, so it slides into view with its name.
    const panning = renderInSvg(layer(plotWidth));
    expect(glyphAt(panning.container, 0, 0)).not.toBeNull();
    expect(
      Number(screen.getByText("Upstream protein").getAttribute("x")),
    ).toBeLessThan(0);
    panning.unmount();

    const pressed = renderInSvg(layer(0, { rowIndex: 0, featureIndex: 0 }));
    expect(glyphAt(pressed.container, 0, 0)).not.toBeNull();
  });

  it("draws orphans, pseudogenes, other features and lone families each in their style", () => {
    const { container } = renderInSvg(
      <GlyphLayer
        model={mixed}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        pressed={null}
        measure={measure}
      />,
    );
    // An orphan gene: a quiet neutral arrow, with no fill of its own.
    const orphan = glyphAt(container, 2, 0);
    expect(orphan).not.toHaveAttribute("fill");
    expect(orphan).toHaveClass("fill-muted-foreground/20", "stroke-card");
    expect(orphan).toHaveAttribute("stroke-width", "1");
    // A pseudogene: dashed, its family's fill at a quarter; in no family, neutral.
    const pseudo = glyphAt(container, 2, 2);
    expect(pseudo).toHaveAttribute("fill", familyColor(4));
    expect(pseudo).toHaveAttribute("fill-opacity", "0.25");
    expect(pseudo).toHaveAttribute("stroke-dasharray", "3 2");
    expect(pseudo).toHaveClass("stroke-foreground/55");
    const loosePseudo = glyphAt(container, 2, 3);
    expect(loosePseudo).not.toHaveAttribute("fill");
    expect(loosePseudo).toHaveClass(
      "fill-muted-foreground/10",
      "stroke-foreground/55",
    );
    expect(loosePseudo).toHaveAttribute("stroke-dasharray", "3 2");
    // RNA and other features: a rounded bar, inset 4 px in the lane.
    const spec = densitySpecs.comfortable;
    const item = mixed.layout.rows[2].features[4];
    const box = glyphBox(spec, mixed.frame.rows[2], item);
    const x = trackScale(mixed.layout.domain, identity, plotWidth);
    const rna = glyphAt(container, 2, 4);
    expect(rna).toHaveClass("fill-muted-foreground/40");
    expect(box.bottom - box.top).toBe(8);
    expect(rna).toHaveAttribute(
      "d",
      glyphPath(spec, "other", x(item.from), x(item.to), box.top, box.bottom),
    );
    // A family seen in one genome only (the focus row's upstream gene): faded.
    expect(glyphAt(container, 0, 0)).toHaveClass("stroke-card", "opacity-45");
  });

  it("dashes Compact's pseudogenes finer", () => {
    const { container } = renderInSvg(
      <GlyphLayer
        model={buildChartModel(
          [focusRow, mirroredRow, mixedRow],
          densitySpecs.compact,
        )}
        matrix={identity}
        plotWidth={696}
        reach={0}
        pressed={null}
        measure={measure}
      />,
    );
    expect(glyphAt(container, 2, 2)).toHaveAttribute(
      "stroke-dasharray",
      "2.5 1.5",
    );
  });
});

describe("track layers", () => {
  it("draws the focus line in the focus orange at offset 0 (D6)", () => {
    const { container } = renderInSvg(
      <FocusLine
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
      />,
    );
    const line = container.querySelector("line");
    expect(line).toHaveAttribute("stroke", focusOrange);
    expect(line).toHaveAttribute("x1", "337");
    expect(line).toHaveAttribute("stroke-dasharray", "4 3");
    expect(line).not.toHaveAttribute("class");
  });

  it("draws no focus line once offset 0 is further off the plot than its reach", () => {
    // 4×: offset 0 at x −652.
    const line = (reach: number) =>
      renderInSvg(
        <FocusLine
          model={comfortable}
          matrix={{ scaleX: 4, translateX: -2000 }}
          plotWidth={plotWidth}
          reach={reach}
        />,
      ).container.querySelector("line");
    expect(line(0)).toBeNull();
    expect(line(plotWidth)).toHaveAttribute("x1", "-652");
  });

  it("labels the ruler from the focus gene, hiding majors at the edges", () => {
    renderInSvg(
      <RulerAxis model={comfortable} matrix={identity} plotWidth={plotWidth} />,
    );
    expect(screen.getByText("0")).toHaveClass("font-semibold");
    expect(screen.getByText("−0.5 kb")).toBeInTheDocument();
    expect(screen.getByText("+0.5 kb")).toBeInTheDocument();
    // At x 0, inside the 20 px edge.
    expect(screen.getByText("−1.0 kb").parentElement).toHaveClass("hidden");
    expect(screen.getByText("−0.5 kb").parentElement).not.toHaveClass("hidden");
  });

  it("labels the ruler in bp once the zoom steps under 500 bp", () => {
    renderInSvg(
      <RulerAxis model={comfortable} matrix={fourFold} plotWidth={plotWidth} />,
    );
    for (const label of ["−200 bp", "−100 bp", "0", "+100 bp", "+200 bp"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("draws no resting ribbon for the focus family alone", () => {
    const { container } = renderInSvg(
      <RibbonLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
      />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(0);
  });

  it("draws a faint resting band in Comfortable", () => {
    const moved = buildChartModel(movedRows, densitySpecs.comfortable);
    const { container } = renderInSvg(
      <RibbonLayer
        model={moved}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
      />,
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveAttribute("fill", familyColor(3));
    expect(paths[0].parentElement).toHaveAttribute("fill-opacity", "0.12");
  });

  it("draws Compact's connector, faded by its sideways reach", () => {
    const moved = buildChartModel(movedRows, densitySpecs.compact);
    const { container } = renderInSvg(
      <RibbonLayer
        model={moved}
        matrix={identity}
        plotWidth={696}
        reach={0}
      />,
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveAttribute("d", "M87,51.5C87,62 574.2,62 574.2,72.5");
    expect(paths[0]).toHaveAttribute("stroke", familyColor(3));
    // round(0.5 × 0.35 × 100) / 100
    expect(paths[0]).toHaveAttribute("stroke-opacity", "0.18");
  });

  it("tints the hovered row as an overlay, with an edge in the label column", () => {
    const { container } = renderInSvg(
      <RowHoverContext value={1}>
        <RowTint frame={compact.frame} x={0} width={203} edge />
      </RowHoverContext>,
    );
    const tint = container.querySelector("[data-overlay]");
    const rects = tint?.querySelectorAll("rect") ?? [];
    expect(rects).toHaveLength(2);
    expect(rects[0]).toHaveAttribute(
      "y",
      String(compact.frame.rows[1].slotTop),
    );
    expect(rects[1]).toHaveAttribute("width", "2");
  });

  it("tints nothing with no row hovered", () => {
    const { container } = renderInSvg(
      <RowTint frame={compact.frame} x={0} width={203} edge />,
    );
    expect(container.querySelector("rect")).toBeNull();
  });

  it("draws each row's contig line, ticked where the contig starts or ends", () => {
    const { container } = renderInSvg(
      <Baselines model={mixed} matrix={identity} plotWidth={plotWidth} />,
    );
    const at = (line: Element, name: string) => Number(line.getAttribute(name));
    const [focus, mirrored, cut] = [
      ...container.querySelectorAll("svg > g > g"),
    ].map((row) => [...row.querySelectorAll("line")]);
    // The focus row's window lies inside its contig: a plain line across the plot.
    expect(focus).toHaveLength(1);
    expect(at(focus[0], "x1")).toBe(0);
    expect(at(focus[0], "x2")).toBe(plotWidth);
    expect(at(focus[0], "y1")).toBe(mixed.frame.rows[0].center);
    // The mirrored row's contig ends at offset −500 (x 168.5): a 1.5 px tick there.
    expect(mirrored).toHaveLength(2);
    expect(at(mirrored[0], "x2")).toBeCloseTo(168.5, 6);
    expect(at(mirrored[1], "x1")).toBeCloseTo(168.5, 6);
    expect(mirrored[1]).toHaveAttribute("stroke-width", "1.5");
    expect(at(mirrored[1], "y1")).toBe(mixed.frame.rows[1].center - 6);
    expect(at(mirrored[1], "y2")).toBe(mixed.frame.rows[1].center + 6);
    // The third row's contig starts at offset −800 (x 67.4).
    expect(cut).toHaveLength(2);
    expect(at(cut[0], "x1")).toBeCloseTo(67.4, 6);
    expect(at(cut[1], "x1")).toBeCloseTo(67.4, 6);
    expect(cut[1]).toHaveAttribute("stroke-width", "1.5");
  });

  it("bands every other row and washes the focus row in the focus orange (D6)", () => {
    const { container } = renderInSvg(
      <TrackBands frame={mixed.frame} plotWidth={plotWidth} />,
    );
    const [wash, band, ...others] = container.querySelectorAll("rect");
    expect(others).toHaveLength(0);
    expect(wash).toHaveAttribute("fill", focusOrange);
    // The 5% (dark 4%) of the theme's `fill-secondary/5 dark:fill-secondary/4`.
    expect(wash).toHaveClass("opacity-5", "dark:opacity-4");
    expect(wash).toHaveAttribute("y", "30");
    expect(band).toHaveClass("fill-muted/50");
    expect(band).toHaveAttribute("y", String(mixed.frame.rows[1].slotTop));
    const dividers = [...container.querySelectorAll("line")];
    expect(dividers.map((line) => Number(line.getAttribute("y1")))).toEqual(
      mixed.frame.dividers,
    );
    for (const line of dividers) {
      expect(line).toHaveAttribute("x2", String(plotWidth));
    }
    expect(container.querySelector('[class*="secondary"]')).toBeNull();
  });
});

describe("label column", () => {
  it("names each genome on two lines in Comfortable", () => {
    renderInSvg(
      <LabelColumn model={comfortable} labelWidth={280} measure={measure} />,
    );
    expect(screen.getByText("Escherichia coli")).toHaveAttribute(
      "font-size",
      "13",
    );
    expect(screen.getByText("str. K-12 substr. MG1655")).toHaveAttribute(
      "font-size",
      "11.5",
    );
    expect(screen.getByText("Salmonella enterica")).toBeInTheDocument();
    expect(screen.getByText("focus")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(
      screen.getByText("1. Escherichia coli str. K-12 substr. MG1655"),
    ).toBeInTheDocument();
  });

  it.each([280, 238, 208])(
    "gives the identity as a percentage alone, with no dot, in a %i px column",
    (labelWidth) => {
      const { container } = renderInSvg(
        <LabelColumn
          model={comfortable}
          labelWidth={labelWidth}
          measure={measure}
        />,
      );
      expect(screen.getByText("80%")).toBeInTheDocument();
      expect(container.querySelector("circle")).toBeNull();
    },
  );

  it("cuts a long name sooner on the focus row, which keeps room for its wider mark", () => {
    const genomeName =
      "Escherichia coli str. K-12 substr. MG1655 from a long-running laboratory lineage";
    const named = buildChartModel(
      [
        { ...focusRow, genomeName },
        { ...mirroredRow, genomeName },
      ],
      densitySpecs.comfortable,
    );
    renderInSvg(
      <LabelColumn model={named} labelWidth={280} measure={measure} />,
    );
    const [focusStrain, comparedStrain] = screen
      .getAllByText(/^str\. K-12/)
      .map((line) => line.textContent);
    expect(focusStrain).toMatch(/…$/);
    expect(comparedStrain).toMatch(/…$/);
    expect(focusStrain.length).toBeLessThan(comparedStrain.length);
  });

  it("names each genome on two lines in Compact too, in smaller type", () => {
    renderInSvg(
      <LabelColumn model={compact} labelWidth={232} measure={measure} />,
    );
    const species = screen.getByText("Escherichia coli");
    const strain = screen.getByText("str. K-12 substr. MG1655");
    expect(species).toHaveAttribute("font-size", "12");
    expect(strain).toHaveAttribute("font-size", "10.5");
    // Under the species, not beside it, so the strain always shows.
    expect(strain).toHaveAttribute("x", species.getAttribute("x"));
    expect(Number(strain.getAttribute("y"))).toBeGreaterThan(
      Number(species.getAttribute("y")),
    );
    expect(screen.getByText("focus")).toHaveAttribute("fill", focusTextOrange);
  });

  it("sets the tag and the identity on the species' line, not the gene's", () => {
    renderInSvg(
      <LabelColumn model={comfortable} labelWidth={280} measure={measure} />,
    );
    const spec = comfortable.spec;
    const species = screen.getByText("Salmonella enterica");
    // The species' cap middle, the tag's middle and the figures' middle agree.
    const middle =
      Number(species.getAttribute("y")) - (capHeight * spec.speciesSize) / 2;
    const tag = screen.getByText("02").previousElementSibling;
    expect(
      Number(tag?.getAttribute("y")) + Number(tag?.getAttribute("height")) / 2,
    ).toBeCloseTo(middle, 6);
    expect(Number(screen.getByText("80%").getAttribute("y"))).toBeCloseTo(
      middle + (capHeight * spec.identitySize) / 2,
      6,
    );
    // Centered in the row's slot, below the gene's middle.
    expect(middle).not.toBe(comfortable.frame.rows[1].center);
  });

  it("tags the rows 01 and 02, the focus row's in the focus orange (D6)", () => {
    renderInSvg(
      <LabelColumn model={comfortable} labelWidth={226} measure={measure} />,
    );
    const focusTag = screen.getByText("01");
    expect(focusTag.previousElementSibling).toHaveAttribute(
      "fill",
      focusOrange,
    );
    // Inked like a label on a family fill, whatever the theme.
    expect(focusTag).toHaveAttribute("fill", labelInk);
    const tag = screen.getByText("02");
    expect(tag).not.toHaveAttribute("fill");
    expect(tag).toHaveClass("fill-foreground/70");
  });

  it("marks the focus row in the focus orange, its text a readable shade deeper, not the theme's secondary color (D6)", () => {
    const { container } = renderInSvg(
      <LabelColumn model={comfortable} labelWidth={226} measure={measure} />,
    );
    // The orange itself is 2.5:1 as text on the light cards.
    const focusText = screen.getByText("focus");
    expect(focusText).toHaveAttribute("fill", focusTextOrange);
    // Dark themes set it in the foreground color: the class beats the attribute.
    expect(focusText).toHaveClass("dark:fill-foreground");
    const accent = container.querySelector('rect[width="3"]');
    expect(accent).toHaveAttribute("fill", focusOrange);
    expect(accent).toHaveAttribute("y", "30");
    expect(accent).not.toHaveAttribute("class");
    const wash = container.querySelector('rect[y="30"][width="226"]');
    expect(wash).toHaveAttribute("fill", focusOrange);
    expect(wash).toHaveClass("opacity-5", "dark:opacity-4");
    expect(container.querySelector('[class*="secondary"]')).toBeNull();
  });

  it("sets the strains, tags, percentages and header in the foreground at 70%, not muted-foreground", () => {
    // `muted-foreground` fell to about 4:1 on the light themes' row bands.
    const { container } = renderInSvg(
      <>
        <LabelColumn model={comfortable} labelWidth={280} measure={measure} />
        <LabelHeader spec={comfortable.spec} labelWidth={280} />
      </>,
    );
    for (const text of ["str. K-12 substr. MG1655", "02", "80%"]) {
      expect(screen.getByText(text)).toHaveClass("fill-foreground/70");
    }
    expect(screen.getByText("Identity").parentElement).toHaveClass(
      "fill-foreground/70",
    );
    const muted = [...container.querySelectorAll("text, tspan, g")].filter(
      (element) => element.classList.contains("fill-muted-foreground"),
    );
    expect(muted).toEqual([]);
  });

  it("heads the column over the ruler", () => {
    renderInSvg(<LabelHeader spec={comfortable.spec} labelWidth={226} />);
    for (const heading of ["#", "Genome", "Identity"]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it("centers the header's words in the band above its rule", () => {
    const { container } = renderInSvg(
      <LabelHeader spec={comfortable.spec} labelWidth={280} />,
    );
    const rule = Number(container.querySelector("line")?.getAttribute("y1"));
    expect(rule).toBe(24);
    for (const heading of ["#", "Genome", "Identity"]) {
      const y = Number(screen.getByText(heading).getAttribute("y"));
      // The caps' middle (10 px words) halfway between the band's top and the rule.
      expect(y - (capHeight * 10) / 2).toBeCloseTo(rule / 2, 6);
    }
  });

  it("keeps the info button's hover fill above the header's rule", () => {
    render(
      <IdentityInfo
        spec={comfortable.spec}
        labelWidth={280}
        measure={measure}
      />,
    );
    const button = screen.getByRole("button", { name: "About identity" });
    // 20 px from 2 px down: 2–22, centered on the words' middle (12), clear of the rule (24).
    expect(button).toHaveClass("size-5");
    expect(button.parentElement).toHaveClass("top-0.5", "flex");
  });

  it("explains identity in a popover from the header's info button", async () => {
    render(
      <IdentityInfo
        spec={comfortable.spec}
        labelWidth={226}
        measure={measure}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About identity" }));
    const popover = await screen.findByRole("dialog", { name: "Identity" });
    expect(popover).toHaveTextContent(
      /How closely the gene each row is aligned on matches the focus gene/,
    );
    expect(popover).toHaveTextContent("100% is an exact match");
  });
});

describe("family trace", () => {
  const focusGene = { rowIndex: 0, featureIndex: 1 };
  const upstreamGene = { rowIndex: 0, featureIndex: 0 };

  it("veils the track and redraws the hovered gene's family over it", () => {
    const { container } = traced(
      focusGene,
      null,
      <>
        <TraceVeil model={comfortable} plotWidth={plotWidth} />
        <HighlightLayer
          model={comfortable}
          matrix={identity}
          plotWidth={plotWidth}
          reach={0}
          measure={measure}
        />
      </>,
    );
    const veil = container.querySelector("[data-trace-veil]");
    expect(veil).toHaveAttribute("data-overlay");
    expect(veil).toHaveClass("fill-card", "opacity-80");
    expect(veil).toHaveAttribute("y", "30");
    expect(veil).toHaveAttribute("width", String(plotWidth));
    const overlay = container.querySelector("g[data-overlay]");
    expect(overlay).not.toBeNull();
    // The family's ribbon, then its two genes on top.
    expect(overlay?.querySelector("g.opacity-55 path")).toHaveAttribute(
      "fill",
      focusOrange,
    );
    expect(
      overlay?.querySelectorAll(`[data-trace-slot] > path[fill="${focusOrange}"]`),
    ).toHaveLength(2);
    // The trace is never a pointer target.
    expect(overlay?.querySelector("[data-feature]")).toBeNull();
    expect(overlay?.querySelector(".stroke-foreground\\/70")).not.toBeNull();
  });

  it("rings the pinned gene", () => {
    const { container } = traced(
      undefined,
      focusGene,
      <HighlightLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        measure={measure}
      />,
    );
    expect(container.querySelector(".stroke-primary")).not.toBeNull();
  });

  it("lifts the veil with nothing traced", () => {
    const { container } = traced(
      undefined,
      null,
      <>
        <TraceVeil model={comfortable} plotWidth={plotWidth} />
        <HighlightLayer
          model={comfortable}
          matrix={identity}
          plotWidth={plotWidth}
          reach={0}
          measure={measure}
        />
        <LabelHighlight model={comfortable} labelWidth={226} />
      </>,
    );
    const [veil, track, labels] = container.querySelectorAll("[data-overlay]");
    expect(veil).toHaveClass("opacity-0");
    expect(track.querySelectorAll("path")).toHaveLength(0);
    // The label column's marks stay drawn, transparent, to fade in.
    const marks = labels.querySelectorAll("rect");
    expect(marks).toHaveLength(4);
    for (const mark of marks) expect(mark).toHaveClass("opacity-0");
  });

  it("crossfades from one family's trace to the next", () => {
    const layer = (
      <HighlightLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        measure={measure}
      />
    );
    const { container, rerender } = traced(focusGene, null, layer);
    const [first, second] = container.querySelectorAll("[data-trace-slot]");
    expect(first).toHaveClass("opacity-100");
    expect(first.querySelector(`path[fill="${focusOrange}"]`)).not.toBeNull();
    expect(second).toHaveClass("opacity-0");
    expect(second.childElementCount).toBe(0);

    // The new family fades in in the other slot as the last one fades out.
    rerender(tracedTree(upstreamGene, null, layer));
    expect(second).toHaveClass("opacity-100");
    expect(
      second.querySelector(`path[fill="${familyColor(3)}"]`),
    ).not.toBeNull();
    expect(first).toHaveClass("opacity-0");
    expect(first.querySelector(`path[fill="${focusOrange}"]`)).not.toBeNull();

    // Its fade over, the last family's trace goes.
    fireEvent.transitionEnd(first);
    expect(first.childElementCount).toBe(0);
    expect(second.childElementCount).toBeGreaterThan(0);
  });

  it("keeps the trace steady between genes of one family", () => {
    const layer = (
      <HighlightLayer
        model={comfortable}
        matrix={identity}
        plotWidth={plotWidth}
        reach={0}
        measure={measure}
      />
    );
    const homolog = focusMembers(comfortable, focusGene).find(
      (ref) => ref.rowIndex === 1,
    );
    if (!homolog) throw new Error("no homolog below the focus gene");
    const { container, rerender } = traced(focusGene, null, layer);
    rerender(tracedTree(homolog, null, layer));
    const [first, second] = container.querySelectorAll("[data-trace-slot]");
    expect(first).toHaveClass("opacity-100");
    expect(second).toHaveClass("opacity-0");
    expect(second.childElementCount).toBe(0);
  });

  it("edges the label column's rows that hold the family", () => {
    const { container } = traced(
      focusGene,
      null,
      <LabelHighlight model={comfortable} labelWidth={226} />,
    );
    const edges = container.querySelectorAll("[data-label-edge]");
    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(edge).toHaveAttribute("fill", focusOrange);
      expect(edge).toHaveAttribute("width", "3");
      expect(edge).toHaveClass("opacity-100");
    }
    for (const fade of container.querySelectorAll("[data-label-fade]")) {
      expect(fade).toHaveClass("opacity-0");
    }
  });

  it("fades the label column's rows without the family", () => {
    const { container } = traced(
      upstreamGene,
      null,
      <LabelHighlight model={comfortable} labelWidth={226} />,
    );
    const [edge, otherEdge] = container.querySelectorAll("[data-label-edge]");
    const [ownFade, fade] = container.querySelectorAll("[data-label-fade]");
    expect(edge).toHaveAttribute("fill", familyColor(3));
    expect(edge).toHaveAttribute("y", "30");
    expect(edge).toHaveClass("opacity-100");
    expect(otherEdge).toHaveClass("opacity-0");
    expect(ownFade).toHaveClass("opacity-0");
    expect(fade).toHaveClass("fill-card", "opacity-70");
    expect(fade).toHaveAttribute("y", "84");
    expect(fade).toHaveAttribute("width", "225");
  });
});

describe("CompareRegionTooltip", () => {
  it("describes the hovered gene", () => {
    render(
      <CompareRegionTooltip
        ref={null}
        model={comfortable}
        at={{ rowIndex: 0, featureIndex: 1 }}
      />,
    );
    expect(screen.getByText("fig|1.1.peg.2")).toBeInTheDocument();
    expect(screen.getByText("Focus protein")).toBeInTheDocument();
    expect(screen.getByText("900…1,200 (301 bp, +)")).toBeInTheDocument();
    expect(screen.getByText("PGF_00000001")).toBeInTheDocument();
    expect(screen.getByText("· in 2 of 2 genomes")).toBeInTheDocument();
    expect(screen.getByText("100% to the focus gene")).toBeInTheDocument();
    expect(
      screen.getByText("Escherichia coli str. K-12 substr. MG1655"),
    ).toBeInTheDocument();
  });

  it("shows nothing with no gene hovered", () => {
    const { container } = render(
      <CompareRegionTooltip ref={null} model={comfortable} at={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden until the chart places it beside its gene", () => {
    const { container } = render(
      <CompareRegionTooltip
        ref={null}
        model={comfortable}
        at={{ rowIndex: 0, featureIndex: 1 }}
      />,
    );
    expect(container.querySelector("[data-feature-tooltip]")).toHaveAttribute(
      "data-offscreen",
    );
  });
});

describe("Legend", () => {
  it("is a labelled group that takes focus only while it scrolls sideways", () => {
    const scrollWidth = vi
      .spyOn(Element.prototype, "scrollWidth", "get")
      .mockReturnValue(640);
    const clientWidth = vi
      .spyOn(Element.prototype, "clientWidth", "get")
      .mockReturnValue(360);
    const { unmount } = render(<Legend />);
    // A phone's one line scrolls: a keyboard must be able to reach it.
    expect(screen.getByRole("group", { name: "Legend" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    unmount();
    scrollWidth.mockReturnValue(360);
    render(<Legend />);
    // Wrapped or fitting, it is no tab stop.
    expect(screen.getByRole("group", { name: "Legend" })).not.toHaveAttribute(
      "tabindex",
    );
    scrollWidth.mockRestore();
    clientWidth.mockRestore();
  });

  it("keys every kind of glyph", () => {
    render(<Legend />);
    for (const entry of [
      "Shared by most genomes",
      "Focus family",
      "By family",
      "In one genome",
      "No family",
      "Pseudogene",
      "BLAST identity",
      "RNA, other",
      "Zoom in for names, more ribbons",
    ]) {
      expect(screen.getByText(entry)).toBeInTheDocument();
    }
  });
});
