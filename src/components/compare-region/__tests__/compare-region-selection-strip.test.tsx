import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  defaultCompareRegionSettings,
  type CompareRegionRow,
  type CompareRegionSettings,
} from "@/lib/compare-region/contract";
import type { CompareRegionDensity } from "@/lib/compare-region/density-options";
import { densitySpecs } from "@/lib/compare-region/density";
import {
  buildChartModel,
  resolveFeature,
  type FeatureRef,
} from "@/lib/compare-region/families";
import { featureHref } from "@/lib/views/hrefs";
import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";
import { HoverContext, PinContext } from "../compare-region-highlight";
import { SelectionStrip } from "../compare-region-selection-strip";

// Spied, to count the strip's renders: it resolves the pin first thing.
vi.mock("@/lib/compare-region/families", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/compare-region/families")>();
  return { ...actual, resolveFeature: vi.fn(actual.resolveFeature) };
});

/** The focus row with an RNA gene: it has a feature page, but no Compare Region tab. */
const rnaRow: CompareRegionRow = {
  ...focusRow,
  features: [
    ...focusRow.features,
    testGene("fig|1.1.rna.3", 1400, 1500, { type: "rna", product: "tRNA-Ala" }),
  ],
};

function renderStrip({
  selected = null,
  density = "comfortable",
  rows = [focusRow, mirroredRow],
  settings = defaultCompareRegionSettings,
}: {
  selected?: FeatureRef | null;
  density?: CompareRegionDensity;
  rows?: CompareRegionRow[];
  settings?: CompareRegionSettings;
} = {}) {
  const onDensityChange = vi.fn();
  const onClear = vi.fn();
  render(
    <PinContext value={selected}>
      <SelectionStrip
        model={buildChartModel(rows, densitySpecs[density])}
        settings={settings}
        density={density}
        onDensityChange={onDensityChange}
        onClear={onClear}
      />
    </PinContext>,
  );
  return { onDensityChange, onClear };
}

function densityToggle(next: "Comfortable" | "Compact") {
  return screen.getByRole("button", { name: `Switch to ${next} density` });
}

describe("SelectionStrip", () => {
  it("shows how to use the figure, and the density toggle, with nothing pinned", () => {
    renderStrip();
    expect(
      screen.getByText("Hover a gene to trace its family"),
    ).toBeInTheDocument();
    expect(screen.getByText("Click for details")).toBeInTheDocument();
    expect(screen.getByText("Drag to pan")).toBeInTheDocument();
    expect(screen.getByText("Ctrl").parentElement).toHaveTextContent(
      "⌘/Ctrl+ scroll to zoom",
    );
    // One icon button, named for the density it switches to, with no label beside it.
    expect(densityToggle("Compact").textContent).toBe("");
    expect(densityToggle("Compact").querySelector("svg")).toHaveClass(
      "lucide-list-chevrons-down-up",
    );
    expect(screen.queryByText("Density")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("offers Comfortable from Compact", () => {
    renderStrip({ density: "compact" });
    expect(densityToggle("Comfortable").querySelector("svg")).toHaveClass(
      "lucide-list-chevrons-up-down",
    );
    expect(
      screen.queryByRole("button", { name: "Switch to Compact density" }),
    ).not.toBeInTheDocument();
  });

  it("draws the toggle in the foreground, as the bar's Export, and a size up from it", () => {
    renderStrip();
    const toggle = densityToggle("Compact");
    // The hint row around it is muted; the toggle is not.
    expect(toggle.parentElement).toHaveClass("text-foreground");
    expect(toggle).toHaveClass("size-8");
    expect(toggle.querySelector("svg")).toHaveClass("size-4.5");
  });

  it("switches the density, with no pinned row", async () => {
    const user = userEvent.setup();
    const { onDensityChange } = renderStrip();
    await user.click(densityToggle("Compact"));
    expect(onDensityChange).toHaveBeenCalledExactlyOnceWith("compact", null);
  });

  it.each([
    [
      "comfortable",
      "Compact",
      "Shrink the rows to fit more genomes on screen.",
    ],
    ["compact", "Comfortable", "Show bigger rows that are easier to read."],
  ] as const)(
    "says in one plain sentence what the switch does, from %s",
    async (density, next, sentence) => {
      const user = userEvent.setup();
      renderStrip({ density });
      await user.hover(densityToggle(next));
      const tip = await screen.findByText(sentence);
      // That sentence alone: no title line, no measurements.
      expect(tip.closest('[data-slot="tooltip-content"]')?.textContent).toBe(
        sentence,
      );
    },
  );

  it("names the pinned gene, links it and clears it", async () => {
    const user = userEvent.setup();
    const fid = "fig|1.1.peg.2";
    const { onClear } = renderStrip({
      selected: { rowIndex: 0, featureIndex: 1 },
    });
    expect(screen.getByText(fid)).toBeInTheDocument();
    expect(screen.getByText("Focus protein")).toBeInTheDocument();
    expect(screen.getByText("PGF_00000001")).toBeInTheDocument();
    expect(screen.getByText("Escherichia coli")).toBeInTheDocument();
    // On the strip's muted wash, `muted-foreground` falls under 4.5:1 in two
    // light themes; `foreground/70` clears it in all six.
    const genome = screen.getByText("Escherichia coli").parentElement;
    expect(genome).toHaveClass("text-foreground/70");
    expect(genome).not.toHaveClass("text-muted-foreground");
    // The wash under the genome and the links: theme-contrast.test.ts holds
    // links and foreground/70 readable on `muted` at this share (30%).
    expect(
      screen.getByRole("link", { name: "Open feature" }).closest("div"),
    ).toHaveClass("bg-muted/30");
    expect(screen.getByRole("link", { name: "Open feature" })).toHaveAttribute(
      "href",
      featureHref(fid),
    );
    expect(
      screen.getByRole("link", { name: "Compare regions" }),
    ).toHaveAttribute("href", `${featureHref(fid)}?tab=compare-region`);
    expect(
      screen.queryByText("Hover a gene to trace its family"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("keeps the density toggle beside a pinned gene", async () => {
    const user = userEvent.setup();
    const { onDensityChange } = renderStrip({
      selected: { rowIndex: 1, featureIndex: 0 },
      density: "compact",
    });
    await user.click(densityToggle("Comfortable"));
    expect(onDensityChange).toHaveBeenCalledExactlyOnceWith("comfortable", 1);
  });

  it("offers Compare regions for a protein-coding gene only", () => {
    renderStrip({
      selected: { rowIndex: 0, featureIndex: 3 },
      rows: [rnaRow, mirroredRow],
    });
    expect(screen.getByText("fig|1.1.rna.3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open feature" })).toHaveAttribute(
      "href",
      featureHref("fig|1.1.rna.3"),
    );
    expect(
      screen.queryByRole("link", { name: "Compare regions" }),
    ).not.toBeInTheDocument();
  });

  it("links no page for a BLAST hit", () => {
    renderStrip({ selected: { rowIndex: 0, featureIndex: 2 } });
    expect(screen.getByText("fig|1.1.peg.2.BLAST")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("falls back to the hint row for a pin the rows no longer hold", () => {
    renderStrip({ selected: { rowIndex: 5, featureIndex: 0 } });
    expect(
      screen.getByText("Hover a gene to trace its family"),
    ).toBeInTheDocument();
  });

  it("opens the pinned gene's comparison with the settings this one used", () => {
    renderStrip({
      selected: { rowIndex: 0, featureIndex: 1 },
      settings: {
        ...defaultCompareRegionSettings,
        genomes: 20,
        method: "plfam",
      },
    });
    expect(
      screen.getByRole("link", { name: "Compare regions" }),
    ).toHaveAttribute(
      "href",
      `${featureHref("fig|1.1.peg.2")}?tab=compare-region&compare.genomes=20&compare.method=plfam`,
    );
  });

  it("re-renders when the pin changes, never on a hover", () => {
    const model = buildChartModel(
      [focusRow, mirroredRow],
      densitySpecs.comfortable,
    );
    // One element throughout, as the chart's cached one: only a context it reads re-renders it.
    const strip = (
      <SelectionStrip
        model={model}
        settings={defaultCompareRegionSettings}
        density="comfortable"
        onDensityChange={() => undefined}
        onClear={() => undefined}
      />
    );
    const view = (
      selected: FeatureRef | null,
      hovered: FeatureRef | undefined,
    ) => (
      <PinContext value={selected}>
        <HoverContext value={hovered}>{strip}</HoverContext>
      </PinContext>
    );
    const renders = vi.mocked(resolveFeature);
    const { rerender } = render(view(null, undefined));
    renders.mockClear();

    rerender(view(null, { rowIndex: 0, featureIndex: 0 }));
    rerender(view(null, { rowIndex: 1, featureIndex: 0 }));
    expect(renders).not.toHaveBeenCalled();

    rerender(
      view({ rowIndex: 0, featureIndex: 1 }, { rowIndex: 1, featureIndex: 0 }),
    );
    expect(renders).toHaveBeenCalled();
    expect(screen.getByText("fig|1.1.peg.2")).toBeInTheDocument();
  });
});
