import { fireEvent, render, screen } from "@testing-library/react";
import type { CompareRegionRow } from "@/lib/compare-region/contract";
import { featureHref } from "@/lib/views/hrefs";
import {
  focusRow,
  mirroredRow,
  testGene,
} from "@/test-helpers/compare-region";
import { CompareRegionChart } from "../compare-region-chart";

function renderChart(
  rows: readonly CompareRegionRow[] = [focusRow, mirroredRow],
  width = 900,
) {
  return render(<CompareRegionChart rows={rows} width={width} />);
}

/** The tracks viewport: Zoom's container, which holds every glyph. */
function tracksSvg(container: HTMLElement): SVGSVGElement {
  const tracks = container
    .querySelector("[data-track-background]")
    ?.closest("svg");
  if (!tracks) throw new Error("no tracks svg");
  return tracks;
}

/** Whether a wheel over a glyph reaches the tracks svg, where Zoom listens. */
function wheelReachesTracks(
  container: HTMLElement,
  init: WheelEventInit = {},
): boolean {
  const tracks = tracksSvg(container);
  let reached = false;
  const spy = () => {
    reached = true;
  };
  tracks.addEventListener("wheel", spy);
  fireEvent.wheel(glyph(container, 0, 0), { deltaY: 100, ...init });
  tracks.removeEventListener("wheel", spy);
  return reached;
}

/** A row's baseline and contig-end ticks, as their end points. */
function rowLines(container: HTMLElement, row: number) {
  const rowGroup = glyph(container, row, 0).closest("g")?.parentElement;
  if (!rowGroup) throw new Error(`no row group ${String(row)}`);
  return [...rowGroup.querySelectorAll(":scope > line")].map((line) => ({
    x1: line.getAttribute("x1"),
    x2: line.getAttribute("x2"),
    y1: line.getAttribute("y1"),
    y2: line.getAttribute("y2"),
  }));
}

/** Glyph by layout position (see the fixture's comments for the order). */
function glyph(container: HTMLElement, row: number, feature: number): Element {
  const element = container.querySelector(
    `[data-row="${String(row)}"][data-feature="${String(feature)}"]`,
  );
  if (!element) throw new Error(`no glyph ${String(row)}/${String(feature)}`);
  return element;
}

function clickAt(element: Element, from: number, to = from) {
  fireEvent.pointerDown(element, { clientX: from });
  fireEvent.click(element, { clientX: to });
}

describe("CompareRegionChart", () => {
  it("draws one labeled row per genome", () => {
    const { container } = renderChart();
    expect(
      screen.getByRole("img", { name: "Compared regions of 2 genomes" }),
    ).toBeInTheDocument();
    // First three words, then the rest on a second line.
    expect(screen.getByText("Escherichia coli str.")).toBeInTheDocument();
    expect(screen.getByText("K-12 substr. MG1655")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-feature]")).toHaveLength(4);
  });

  it("outlines pinned genes and colors by identity and family", () => {
    const { container } = renderChart();
    const focusGene = glyph(container, 0, 1);
    expect(focusGene).toHaveAttribute("stroke-width", "2");
    expect(focusGene).toHaveAttribute("fill", "rgb(255, 0, 0)");
    expect(glyph(container, 1, 0)).toHaveAttribute("fill", "rgb(255, 51, 51)");
    expect(glyph(container, 0, 0)).toHaveAttribute("fill", "rgb(224, 133, 15)");
    expect(glyph(container, 0, 0)).toHaveAttribute("stroke-width", "1");
  });

  it("shows a feature's details on hover", () => {
    const { container } = renderChart();
    fireEvent.pointerOver(glyph(container, 0, 1), { clientX: 40, clientY: 40 });
    expect(screen.getByText("Focus protein")).toBeInTheDocument();
    expect(screen.getByText("900…1,200 (301 bp, +)")).toBeInTheDocument();
    expect(screen.getByText("PGF_00000001")).toBeInTheDocument();
    expect(screen.getByText("100% to the focus gene")).toBeInTheDocument();
  });

  it("selects a gene on click and links to it", () => {
    const { container } = renderChart();
    clickAt(glyph(container, 0, 1), 10);
    expect(screen.getByRole("link", { name: "Open feature" })).toHaveAttribute(
      "href",
      featureHref("fig|1.1.peg.2"),
    );
    expect(
      screen.getByRole("link", { name: "Compare regions around this gene" }),
    ).toHaveAttribute("href", `${featureHref("fig|1.1.peg.2")}?tab=compare-region`);
    expect(glyph(container, 0, 1)).toHaveAttribute("stroke-width", "3");
  });

  it("offers no links for a BLAST hit", () => {
    const { container } = renderChart();
    clickAt(glyph(container, 0, 2), 10);
    expect(screen.getByText("fig|1.1.peg.2.BLAST")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
  });

  it("clears the selection on a click in empty track", () => {
    const { container } = renderChart();
    clickAt(glyph(container, 0, 1), 10);
    const background = container.querySelector("[data-track-background]");
    if (!background) throw new Error("no track background");
    clickAt(background, 10);
    expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
  });

  it("ignores the click that ends a drag", () => {
    const { container } = renderChart();
    clickAt(glyph(container, 0, 1), 10, 40);
    expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
  });

  it("zooms with the buttons and resets", () => {
    const { container } = renderChart();
    const before = glyph(container, 0, 0).getAttribute("d");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(glyph(container, 0, 0).getAttribute("d")).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(glyph(container, 0, 0).getAttribute("d")).toBe(before);
  });

  it("names a single genome in the singular", () => {
    renderChart([focusRow]);
    expect(
      screen.getByRole("img", { name: "Compared regions of 1 genome" }),
    ).toBeInTheDocument();
  });

  it("draws a short genome name on one line", () => {
    renderChart();
    const label = screen.getByText("Salmonella enterica", { selector: "tspan" });
    expect(label.parentElement?.querySelectorAll("tspan")).toHaveLength(1);
  });

  it("marks the contig end a window runs past", () => {
    const { container } = renderChart();
    // The focus row's window lies inside its contig: a baseline only.
    expect(rowLines(container, 0)).toHaveLength(1);
    expect(rowLines(container, 1)).toHaveLength(2);
    const [baseline, tick] = rowLines(container, 1);
    expect(tick).toEqual({
      x1: baseline.x2,
      x2: baseline.x2,
      y1: "-5",
      y2: "5",
    });
  });

  it("marks the contig start a window runs past", () => {
    const { container } = renderChart([{ ...focusRow, start: -200 }]);
    const [baseline, tick] = rowLines(container, 0);
    expect(tick).toEqual({
      x1: baseline.x1,
      x2: baseline.x1,
      y1: "-5",
      y2: "5",
    });
  });

  it("skips glyphs zoomed out of view", () => {
    const { container } = renderChart();
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    // 2.25× about the center leaves the upstream gene left of the window.
    expect(container.querySelector('[data-row="0"][data-feature="0"]')).toBeNull();
    expect(glyph(container, 0, 1)).toBeInTheDocument();
    expect(container.querySelectorAll("[data-feature]")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(container.querySelectorAll("[data-feature]")).toHaveLength(4);
  });

  it("skips no glyph while a drag pans, so the pressed one is never removed", () => {
    // use-gesture captures the pointer on the pressed glyph; removing that
    // glyph would lose the capture, and with it the drag's end.
    const pointerCapture = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    };
    Object.assign(Element.prototype, pointerCapture);
    try {
      const { container } = renderChart();
      const zoomIn = screen.getByRole("button", { name: "Zoom in" });
      fireEvent.click(zoomIn);
      fireEvent.click(zoomIn);
      const offScreen = '[data-row="0"][data-feature="0"]';
      expect(container.querySelector(offScreen)).toBeNull();

      const focusGene = glyph(container, 0, 1);
      const pointer = { pointerId: 1, buttons: 1, clientY: 30 };
      fireEvent.pointerDown(focusGene, { ...pointer, clientX: 400 });
      fireEvent.pointerMove(focusGene, { ...pointer, clientX: 390 });
      expect(pointerCapture.setPointerCapture).toHaveBeenCalled();
      expect(container.querySelector(offScreen)).toBeInTheDocument();

      fireEvent.pointerUp(focusGene, { ...pointer, buttons: 0, clientX: 390 });
      expect(container.querySelector(offScreen)).toBeNull();
    } finally {
      for (const name of Object.keys(pointerCapture)) {
        Reflect.deleteProperty(Element.prototype, name);
      }
    }
  });

  it("clears the selection with its button", () => {
    const { container } = renderChart();
    clickAt(glyph(container, 0, 1), 10);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
    expect(glyph(container, 0, 1)).toHaveAttribute("stroke-width", "2");
  });

  it("links an RNA to its feature but not to a comparison", () => {
    const withRna: CompareRegionRow = {
      ...focusRow,
      features: [
        ...focusRow.features,
        testGene("fig|1.1.rna.3", 1500, 1600, { type: "tRNA" }),
      ],
    };
    const { container } = renderChart([withRna, mirroredRow]);
    clickAt(glyph(container, 0, 3), 10);
    expect(screen.getByRole("link", { name: "Open feature" })).toHaveAttribute(
      "href",
      featureHref("fig|1.1.rna.3"),
    );
    expect(
      screen.queryByRole("link", { name: "Compare regions around this gene" }),
    ).toBeNull();
  });

  it("words a missing product the same in the tooltip and the toolbar", () => {
    const unnamed: CompareRegionRow = {
      ...focusRow,
      features: focusRow.features.map((feature, index) =>
        index === 0 ? { ...feature, product: "" } : feature,
      ),
    };
    const { container } = renderChart([unnamed, mirroredRow]);
    fireEvent.pointerOver(glyph(container, 0, 0), { clientX: 40, clientY: 40 });
    expect(screen.getByText("No product")).toBeInTheDocument();
    // The press hides the tooltip; the click selects.
    clickAt(glyph(container, 0, 0), 10);
    expect(screen.getByText("No product")).toBeInTheDocument();
  });

  it("hides the tooltip when the pointer moves on to the labels", () => {
    const { container } = renderChart();
    const focusGene = glyph(container, 0, 1);
    fireEvent.pointerOver(focusGene, { clientX: 40, clientY: 40 });
    expect(screen.getByText("Focus protein")).toBeInTheDocument();
    fireEvent.pointerOut(focusGene, {
      relatedTarget: screen.getByText("Escherichia coli str."),
    });
    expect(screen.queryByText("Focus protein")).toBeNull();
  });

  it("hides the tooltip when a drag starts", () => {
    const { container } = renderChart();
    const focusGene = glyph(container, 0, 1);
    fireEvent.pointerOver(focusGene, { clientX: 40, clientY: 40 });
    fireEvent.pointerDown(focusGene, { clientX: 40 });
    expect(screen.queryByText("Focus protein")).toBeNull();
  });

  it("leaves vertical touch scrolling to the page", () => {
    const { container } = renderChart();
    expect(tracksSvg(container)).toHaveClass("touch-pan-y");
    expect(tracksSvg(container)).not.toHaveClass("touch-none");
  });

  it("passes a plain wheel to the page, also after a resize", () => {
    const { container, rerender } = renderChart();
    expect(wheelReachesTracks(container)).toBe(false);
    rerender(<CompareRegionChart rows={[focusRow, mirroredRow]} width={1000} />);
    expect(wheelReachesTracks(container)).toBe(false);
    expect(wheelReachesTracks(container, { ctrlKey: true })).toBe(true);
  });

  it("keeps the tracks whole below their minimum width, scrolling sideways", () => {
    const { container } = renderChart([focusRow, mirroredRow], 300);
    const chart = screen.getByRole("img", { name: "Compared regions of 2 genomes" });
    // The 250 px label column plus the tracks' 200 px floor.
    expect(chart).toHaveAttribute("width", "450");
    expect(tracksSvg(container)).toHaveAttribute("width", "200");
    expect(chart.parentElement).toHaveClass("overflow-x-auto");
  });

  it("lets keyboard users focus the scroller to scroll a wide chart", () => {
    renderChart([focusRow, mirroredRow], 300);
    expect(
      screen.getByRole("group", { name: "Compared regions (scrollable)" }),
    ).toHaveAttribute("tabindex", "0");
  });
});
