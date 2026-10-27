import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { useState } from "react";
import {
  defaultCompareRegionSettings,
  type CompareRegionRow,
} from "@/lib/compare-region/contract";
import type { CompareRegionDensity } from "@/lib/compare-region/density-options";
import { rowIdentity } from "@/lib/compare-region/genome-labels";
import { placeGlyph } from "@/lib/compare-region/glyph-placement";
import { rulerTicks } from "@/lib/compare-region/ruler";
import { featureHref } from "@/lib/views/hrefs";
import { focusRow, mirroredRow } from "@/test-helpers/compare-region";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { CompareRegionChart } from "../compare-region-chart";
import { ZoomCluster } from "../compare-region-zoom-controls";
import { hoverGrace } from "../use-chart-pointer";

// Spied, to count the label column's renders: it reads every row's identity.
vi.mock("@/lib/compare-region/genome-labels", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/compare-region/genome-labels")>();
  return { ...actual, rowIdentity: vi.fn(actual.rowIdentity) };
});
// Spied, to count glyph placements: a pan slides what is drawn, placing none.
vi.mock("@/lib/compare-region/glyph-placement", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/compare-region/glyph-placement")
    >();
  return { ...actual, placeGlyph: vi.fn(actual.placeGlyph) };
});
// Spied, to count the ruler's renders: it follows every zoom render.
vi.mock("@/lib/compare-region/ruler", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/compare-region/ruler")>();
  return { ...actual, rulerTicks: vi.fn(actual.rulerTicks) };
});
// jsdom has no canvas: the figure measures its labels with the estimate (D9).
vi.mock("@/lib/compare-region/text-measure", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/compare-region/text-measure")>();
  return { ...actual, canvasTextWidth: actual.estimateTextWidth };
});

const twoRows = [focusRow, mirroredRow];

// A click on a gene opens its summary, which reads the gene's record; these
// tests are about the figure, so the read never answers.
beforeEach(() => {
  server.use(
    http.get("*/api/data/genome_feature", () => new Promise(() => undefined)),
  );
});

interface ChartProps {
  rows?: readonly CompareRegionRow[];
  /** A 900 px card: Comfortable's plot is 674 px, Compact's 696 px. */
  width?: number;
  density?: CompareRegionDensity;
  onDensityChange?: (density: CompareRegionDensity) => void;
  onExport?: (svg: SVGSVGElement) => void;
}

/** The chart with the bar's zoom cluster and an export button, as the panel's bar gets them. */
function Chart({
  rows = twoRows,
  width = 900,
  density = "comfortable",
  onDensityChange = () => undefined,
  onExport = () => undefined,
}: ChartProps) {
  return (
    <CompareRegionChart
      rows={rows}
      width={width}
      settings={defaultCompareRegionSettings}
      density={density}
      onDensityChange={onDensityChange}
      onExport={onExport}
      renderBar={(zoom, exportChart) => (
        <div>
          <ZoomCluster zoom={zoom} />
          <button
            type="button"
            disabled={!exportChart}
            onClick={() => exportChart?.()}
          >
            Export
          </button>
        </div>
      )}
    />
  );
}

/** The chart with its density in state, as the panel holds the preference. */
function SwitchableChart(
  props: Omit<ChartProps, "density" | "onDensityChange">,
) {
  const [density, setDensity] = useState<CompareRegionDensity>("comfortable");
  return <Chart {...props} density={density} onDensityChange={setDensity} />;
}

/** Renders, then lets Base UI's slider thumb measure itself (a microtask after mount) inside act. */
async function renderChart(props: ChartProps = {}) {
  const result = render(<Chart {...props} />, {
    wrapper: createQueryClientWrapper(),
  });
  await act(() => Promise.resolve());
  return {
    ...result,
    rerenderChart: (next: ChartProps) => {
      result.rerender(<Chart {...props} {...next} />);
    },
  };
}

async function renderSwitchable(
  props: Omit<ChartProps, "density" | "onDensityChange"> = {},
) {
  const result = render(<SwitchableChart {...props} />, {
    wrapper: createQueryClientWrapper(),
  });
  await act(() => Promise.resolve());
  return result;
}

/** The tracks viewport: Zoom's container, which holds every glyph. */
function tracksSvg(container: HTMLElement): SVGSVGElement {
  const tracks = container
    .querySelector("[data-track-background]")
    ?.closest("svg");
  if (!tracks) throw new Error("no tracks svg");
  return tracks;
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

/** The pinned gene's card, or null while it is put away. */
function featureCard(): HTMLElement | null {
  return screen.queryByRole("dialog", { name: "Feature details" });
}

/** The selection strip while a gene is pinned (the card repeats its lines and links). */
function strip(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-selection-strip]");
  if (!found) throw new Error("no gene pinned in the strip");
  return found;
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

/** The hover tooltip, or null while it is closed. */
function tooltip(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-feature-tooltip]");
}

/** The dashed focus line's x, px from the plot's left edge. */
function focusLineX(container: HTMLElement): number {
  const line = container.querySelector('line[stroke-dasharray="4 3"]');
  if (!line) throw new Error("no focus line");
  return Number(line.getAttribute("x1"));
}

function zoomLevel(): HTMLElement {
  return screen.getByRole("status");
}

function zoomIn(times = 1) {
  const button = screen.getByRole("button", { name: "Zoom in" });
  for (let step = 0; step < times; step += 1) fireEvent.click(button);
}

function scroller(): HTMLElement {
  return screen.getByRole("group", { name: "Compared regions (scrollable)" });
}

function figureSvg(): HTMLElement {
  return screen.getByRole("img", { name: /^Compared regions of/ });
}

describe("CompareRegionChart", () => {
  describe("the figure", () => {
    it("names the figure by its genome count", async () => {
      await renderChart();
      expect(
        screen.getByRole("img", { name: "Compared regions of 2 genomes" }),
      ).toBeInTheDocument();
    });

    it("names a single genome in the singular", async () => {
      await renderChart({ rows: [focusRow] });
      expect(
        screen.getByRole("img", { name: "Compared regions of 1 genome" }),
      ).toBeInTheDocument();
    });

    it("lets keyboard users focus the scroller to scroll a large figure", async () => {
      await renderChart({ width: 300 });
      expect(scroller()).toHaveAttribute("tabindex", "0");
      expect(scroller()).toHaveClass("overflow-auto");
      // The narrow label column and the plot's 420 px floor: wider than the card.
      expect(figureSvg()).toHaveAttribute("width", "616");
    });

    it("fills the card, with the legend at its foot", async () => {
      await renderChart();
      // The scroller takes the room the figure leaves, so the legend sits at
      // the card's bottom edge however few genomes there are.
      expect(scroller()).toHaveClass("min-h-0", "flex-1");
      expect(scroller().parentElement).toHaveClass("flex-1");
      expect(scroller().nextElementSibling).toHaveTextContent(
        "Shared by most genomes",
      );
    });

    it("leaves vertical touch scrolling to the page", async () => {
      const { container } = await renderChart();
      expect(tracksSvg(container)).toHaveClass("touch-pan-y");
      expect(tracksSvg(container)).not.toHaveClass("touch-none");
    });

    it("pins the label column and the ruler while the figure scrolls (D8)", async () => {
      const { container } = await renderChart();
      const view = scroller();
      view.scrollTop = 40;
      view.scrollLeft = 15;
      fireEvent.scroll(view);
      // In document order: the ruler, the label column, its header.
      const [ruler, labels, header] =
        container.querySelectorAll("[data-sticky]");
      expect(ruler).toHaveAttribute("transform", "translate(0 40)");
      expect(labels).toHaveAttribute("transform", "translate(15 0)");
      expect(header).toHaveAttribute("transform", "translate(0 40)");
    });

    it("hands the figure's svg to the export", async () => {
      const onExport = vi.fn<(svg: SVGSVGElement) => void>();
      await renderChart({ onExport });
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      expect(onExport).toHaveBeenCalledWith(figureSvg());
    });
  });

  describe("hover and pin", () => {
    it("shows a feature's details on hover", async () => {
      const { container } = await renderChart();
      fireEvent.pointerOver(glyph(container, 0, 1), {
        clientX: 40,
        clientY: 40,
      });
      const box = tooltip();
      if (!box) throw new Error("no tooltip");
      expect(within(box).getByText("Focus protein")).toBeInTheDocument();
      expect(
        within(box).getByText("900…1,200 (301 bp, +)"),
      ).toBeInTheDocument();
      expect(within(box).getByText("PGF_00000001")).toBeInTheDocument();
      expect(
        within(box).getByText("100% to the focus gene"),
      ).toBeInTheDocument();
    });

    it("pins a gene's tooltip as its card on click, expanded", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      const card = featureCard();
      if (!card) throw new Error("no feature card");
      // Its first line, and its record's BRC ID.
      expect(within(card).getAllByText("fig|1.1.peg.2")).toHaveLength(2);
      expect(
        within(card).getByText("900…1,200 (301 bp, +)"),
      ).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: "Collapse details" }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(
        within(card).getByText("Loading the feature record…"),
      ).toBeInTheDocument();
    });

    it("keeps the card's gene out of the hover tooltip, but not the others", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      fireEvent.pointerOver(glyph(container, 0, 1), {
        clientX: 40,
        clientY: 40,
      });
      expect(tooltip()).toBeNull();
      fireEvent.pointerOver(glyph(container, 0, 0), {
        clientX: 40,
        clientY: 40,
      });
      expect(tooltip()).toHaveTextContent("fig|1.1.peg.1");
    });

    it("moves the card to the next gene clicked", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      clickAt(glyph(container, 0, 0), 10);
      const card = featureCard();
      if (!card) throw new Error("no feature card");
      // Its first line, and its record's BRC ID.
      expect(within(card).getAllByText("fig|1.1.peg.1")).toHaveLength(2);
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
    });

    it("puts the card away with the pin on a click in the empty track", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      const background = container.querySelector("[data-track-background]");
      if (!background) throw new Error("no track background");
      clickAt(background, 10);
      expect(featureCard()).toBeNull();
      expect(screen.getByText("Click for details")).toBeInTheDocument();
    });

    it("clears the pin when the card is closed, by its button or Escape", async () => {
      const user = userEvent.setup();
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      const card = featureCard();
      if (!card) throw new Error("no feature card");
      await user.click(
        within(card).getByRole("button", { name: "Close details" }),
      );
      expect(featureCard()).toBeNull();
      expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
      expect(screen.getByText("Click for details")).toBeInTheDocument();

      clickAt(glyph(container, 0, 0), 10);
      const next = featureCard();
      if (!next) throw new Error("no feature card");
      // Focus in the card (its Collapse button), then Escape.
      await user.click(
        within(next).getByRole("button", { name: "Collapse details" }),
      );
      await user.keyboard("{Escape}");
      expect(featureCard()).toBeNull();
      expect(screen.getByText("Click for details")).toBeInTheDocument();
    });

    it("pins a gene on click and links to it", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      const pinned = within(strip());
      expect(pinned.getByText("fig|1.1.peg.2")).toBeInTheDocument();
      expect(
        pinned.getByRole("link", { name: "Open feature" }),
      ).toHaveAttribute("href", featureHref("fig|1.1.peg.2"));
      expect(
        pinned.getByRole("link", { name: "Compare regions" }),
      ).toHaveAttribute(
        "href",
        `${featureHref("fig|1.1.peg.2")}?tab=compare-region`,
      );
    });

    it("pins on a click that moved no more than 4 px", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10, 14);
      expect(
        within(strip()).getByRole("link", { name: "Open feature" }),
      ).toBeInTheDocument();
    });

    it("ignores the click that ends a drag", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10, 15);
      expect(featureCard()).toBeNull();
      expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
      expect(screen.getByText("Click for details")).toBeInTheDocument();
    });

    it("clears the pin on a click in the empty track", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      const background = container.querySelector("[data-track-background]");
      if (!background) throw new Error("no track background");
      clickAt(background, 10);
      expect(featureCard()).toBeNull();
      expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
      expect(screen.getByText("Click for details")).toBeInTheDocument();
    });

    it("clears the pin with its button", async () => {
      const { container } = await renderChart();
      clickAt(glyph(container, 0, 1), 10);
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(featureCard()).toBeNull();
      expect(screen.queryByRole("link", { name: "Open feature" })).toBeNull();
    });

    it("words a missing product the same in the tooltip and the strip", async () => {
      const unnamed: CompareRegionRow = {
        ...focusRow,
        features: focusRow.features.map((feature, index) =>
          index === 0 ? { ...feature, product: "" } : feature,
        ),
      };
      const { container } = await renderChart({ rows: [unnamed, mirroredRow] });
      fireEvent.pointerOver(glyph(container, 0, 0), {
        clientX: 40,
        clientY: 40,
      });
      const box = tooltip();
      if (!box) throw new Error("no tooltip");
      expect(within(box).getByText("No product")).toBeInTheDocument();

      // The press hides the tooltip; the click pins the gene.
      clickAt(glyph(container, 0, 0), 10);
      expect(tooltip()).toBeNull();
      const pinned = within(strip());
      expect(pinned.getByText("fig|1.1.peg.1")).toBeInTheDocument();
      expect(pinned.getByText("No product")).toHaveAttribute(
        "title",
        "No product",
      );
    });

    it("keeps the hover while the pointer crosses the empty track to the next gene", async () => {
      const { container } = await renderChart();
      const background = container.querySelector("[data-track-background]");
      if (!background) throw new Error("no track background");
      vi.useFakeTimers();
      try {
        fireEvent.pointerOver(glyph(container, 0, 1), {
          clientX: 40,
          clientY: 40,
        });
        fireEvent.pointerOver(background, { clientX: 60, clientY: 40 });
        act(() => {
          vi.advanceTimersByTime(hoverGrace - 1);
        });
        expect(tooltip()).toHaveTextContent("fig|1.1.peg.2");
        fireEvent.pointerOver(glyph(container, 0, 0), {
          clientX: 80,
          clientY: 40,
        });
        act(() => {
          vi.advanceTimersByTime(hoverGrace);
        });
        expect(tooltip()).toHaveTextContent("fig|1.1.peg.1");

        // Left on the empty track, it lets go.
        fireEvent.pointerOver(background, { clientX: 60, clientY: 40 });
        act(() => {
          vi.advanceTimersByTime(hoverGrace);
        });
        expect(tooltip()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("hides the tooltip when a drag starts", async () => {
      const { container } = await renderChart();
      const focusGene = glyph(container, 0, 1);
      fireEvent.pointerOver(focusGene, { clientX: 40, clientY: 40 });
      expect(tooltip()).not.toBeNull();
      fireEvent.pointerDown(focusGene, { clientX: 40 });
      expect(tooltip()).toBeNull();
    });

    it("hides the tooltip when the pointer moves on to the labels", async () => {
      const { container } = await renderChart();
      const focusGene = glyph(container, 0, 1);
      fireEvent.pointerOver(focusGene, { clientX: 40, clientY: 40 });
      expect(tooltip()).not.toBeNull();
      fireEvent.pointerOut(focusGene, {
        relatedTarget: screen.getByText("Salmonella enterica"),
      });
      expect(tooltip()).toBeNull();
    });
  });

  describe("a classic scrollbar (I1)", () => {
    const scrollerName = "Compared regions (scrollable)";
    /** The scroller's widths: its box and the part a scrollbar leaves for content. */
    const scrollerSize = { offset: 900, client: 900 };
    let resized: (() => void) | undefined;
    const spies: { mockRestore: () => void }[] = [];
    const realResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
      scrollerSize.offset = 900;
      scrollerSize.client = 900;
      const isScroller = (element: Element) =>
        element.getAttribute("aria-label") === scrollerName;
      spies.push(
        vi
          .spyOn(HTMLElement.prototype, "offsetWidth", "get")
          .mockImplementation(function (this: HTMLElement) {
            return isScroller(this) ? scrollerSize.offset : 0;
          }),
        vi
          .spyOn(Element.prototype, "clientWidth", "get")
          .mockImplementation(function (this: Element) {
            return isScroller(this) ? scrollerSize.client : 0;
          }),
      );
      // jsdom has none: this one reports a resize when the test says so.
      globalThis.ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) {
          resized = () => {
            callback([], this);
          };
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      };
    });

    afterEach(() => {
      // The config only clears mocks: put the real getters back.
      for (const spy of spies.splice(0)) spy.mockRestore();
      globalThis.ResizeObserver = realResizeObserver;
      resized = undefined;
    });

    it("draws the figure as wide as the scroller leaves room for", async () => {
      // A 15 px vertical scrollbar beside a tall figure.
      scrollerSize.client = 885;
      const { container } = await renderChart();
      expect(figureSvg()).toHaveAttribute("width", "885");
      // 885 px: the same 226 px label column, a 659 px plot.
      expect(tracksSvg(container)).toHaveAttribute("width", "659");
    });

    it("keeps the zoom when a scrollbar appears later (D5)", async () => {
      const { container } = await renderChart();
      expect(figureSvg()).toHaveAttribute("width", "900");
      zoomIn(2);
      expect(focusLineX(container)).toBeCloseTo(337, 6);

      scrollerSize.client = 885;
      act(() => {
        resized?.();
      });
      expect(figureSvg()).toHaveAttribute("width", "885");
      expect(zoomLevel()).toHaveTextContent("2.3×");
      // Still the window's middle: 659 / 2.
      expect(focusLineX(container)).toBeCloseTo(329.5, 6);
    });
  });

  describe("zoom and pan", () => {
    it("passes a plain wheel to the page, also after a resize", async () => {
      const { container, rerenderChart } = await renderChart();
      expect(wheelReachesTracks(container)).toBe(false);
      rerenderChart({ width: 1000 });
      expect(wheelReachesTracks(container)).toBe(false);
      expect(wheelReachesTracks(container, { ctrlKey: true })).toBe(true);
    });

    it("disables the zoom buttons at their limits", async () => {
      await renderChart();
      expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Fit the whole region" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
      expect(zoomLevel()).toHaveTextContent("1.0×");

      zoomIn(7);
      expect(zoomLevel()).toHaveTextContent("17×");
      expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
      zoomIn();
      expect(zoomLevel()).toHaveTextContent("20×");
      expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    });

    it("zooms about the focus line, which stays put", async () => {
      // Centered off the window's middle: domain −500…1,500 bp, so the focus line is at 168.5 of 674 px.
      const { container } = await renderChart({
        rows: [{ ...focusRow, center: 500 }],
      });
      expect(focusLineX(container)).toBe(168.5);
      zoomIn();
      expect(zoomLevel()).toHaveTextContent("1.5×");
      expect(focusLineX(container)).toBeCloseTo(168.5, 6);
    });

    it("skips glyphs zoomed out of view, and fits the whole region again", async () => {
      const { container } = await renderChart();
      zoomIn(2);
      // 2.25× about the focus line leaves the upstream gene left of the window.
      expect(
        container.querySelector('[data-row="0"][data-feature="0"]'),
      ).toBeNull();
      expect(glyph(container, 0, 1)).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Fit the whole region" }),
      );
      expect(zoomLevel()).toHaveTextContent("1.0×");
      expect(glyph(container, 0, 0)).toBeInTheDocument();
    });

    describe("a drag", () => {
      // use-gesture captures the pointer on the pressed glyph, which jsdom
      // cannot do: removing that glyph would lose the capture, and with it
      // the drag's end.
      const pointerCapture = {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: () => true,
      };
      beforeEach(() => {
        Object.assign(Element.prototype, pointerCapture);
      });
      afterEach(() => {
        for (const name of Object.keys(pointerCapture)) {
          Reflect.deleteProperty(Element.prototype, name);
        }
      });

      const pointer = { pointerId: 1, buttons: 1, clientY: 30 };
      /** Press `element` at `from`, then move to each x in turn: the first move starts the drag. */
      function drag(element: Element, from: number, ...moves: number[]) {
        fireEvent.pointerDown(element, { ...pointer, clientX: from });
        for (const clientX of moves) {
          fireEvent.pointerMove(element, { ...pointer, clientX });
        }
      }
      function release(element: Element, at: number) {
        fireEvent.pointerUp(element, { ...pointer, buttons: 0, clientX: at });
      }
      /** The transform sliding `element`'s layer, or null when it is drawn where it stands. */
      function slideOf(element: Element): string | null {
        return element.closest("[data-pan]")?.getAttribute("transform") ?? null;
      }

      it("draws a plot's width past either edge while it pans, then only what is in view", async () => {
        const { container } = await renderChart();
        zoomIn(2);
        // 2.25×: the upstream gene is 118 px left of the window.
        const upstream = '[data-row="0"][data-feature="0"]';
        expect(container.querySelector(upstream)).toBeNull();

        const focusGene = glyph(container, 0, 1);
        drag(focusGene, 400, 390);
        expect(pointerCapture.setPointerCapture).toHaveBeenCalled();
        expect(container.querySelector(upstream)).toBeInTheDocument();

        release(focusGene, 390);
        expect(container.querySelector(upstream)).toBeNull();
      });

      it("draws nothing further than a plot's width off the plot", async () => {
        const { container } = await renderChart();
        zoomIn(4);
        // 5.06×: the upstream gene is 687 px left of the window, past the 674 px reach.
        const focusGene = glyph(container, 0, 1);
        drag(focusGene, 400, 390);
        expect(
          container.querySelector('[data-row="0"][data-feature="0"]'),
        ).toBeNull();
        release(focusGene, 390);
      });

      it("slides what is drawn by one transform as it pans, placing no glyph again", async () => {
        const { container } = await renderChart();
        zoomIn(2);
        const focusGene = glyph(container, 0, 1);
        // Pinned: its ring and its family's trace slide with the glyphs.
        clickAt(focusGene, 400);
        const outline = focusGene.getAttribute("d");
        const focusLine = container.querySelector(
          'line[stroke-dasharray="4 3"]',
        );
        const ring = container.querySelector("[data-overlay] path.stroke-primary");
        const placed = vi.mocked(placeGlyph);

        drag(focusGene, 400, 390);
        placed.mockClear();
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: 370 });
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: 350 });
        expect(placed).not.toHaveBeenCalled();
        expect(focusGene).toHaveAttribute("d", outline);
        expect(slideOf(focusGene)).toBe("translate(-40 0)");
        expect(focusLine && slideOf(focusLine)).toBe("translate(-40 0)");
        expect(ring && slideOf(ring)).toBe("translate(-40 0)");
        // The veil under the trace covers the plot: it does not slide.
        expect(
          slideOf(container.querySelector("[data-trace-veil]") ?? focusGene),
        ).toBeNull();

        // At rest the layers are drawn where they stand, with nothing left to slide.
        release(focusGene, 350);
        expect(placed).toHaveBeenCalled();
        expect(slideOf(glyph(container, 0, 1))).toBeNull();
        expect(glyph(container, 0, 1).getAttribute("d")).not.toBe(outline);
      });

      it("draws again once it pans past what was drawn, keeping the pressed glyph", async () => {
        const { container } = await renderChart();
        zoomIn(4);
        const focusGene = glyph(container, 0, 1);
        drag(focusGene, 400, 390);
        const placed = vi.mocked(placeGlyph);
        placed.mockClear();

        // 700 px: past the 674 px drawn beyond the edge, so it draws again there.
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: -310 });
        expect(placed).toHaveBeenCalled();
        expect(slideOf(focusGene)).toBeNull();
        placed.mockClear();
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: -320 });
        expect(placed).not.toHaveBeenCalled();
        expect(slideOf(focusGene)).toBe("translate(-10 0)");

        // A pan to the track's end leaves the pressed gene far off the plot: still drawn.
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: -2000 });
        expect(focusGene.isConnected).toBe(true);
        expect(glyph(container, 0, 1)).toBe(focusGene);
        release(focusGene, -2000);
        expect(focusGene.isConnected).toBe(false);
      });

      it("re-renders nothing for a drag the track holds still", async () => {
        const { container } = await renderChart();
        // At 1× the whole window is in view: a drag cannot pan.
        const focusGene = glyph(container, 0, 1);
        drag(focusGene, 400, 390);
        const ruler = vi.mocked(rulerTicks);
        ruler.mockClear();
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: 370 });
        fireEvent.pointerMove(focusGene, { ...pointer, clientX: 420 });
        expect(ruler).not.toHaveBeenCalled();
        release(focusGene, 420);
      });
    });

    it("redraws no zoom-independent layer on a zoom (M10)", async () => {
      await renderChart();
      const labelRows = vi.mocked(rowIdentity);
      labelRows.mockClear();
      zoomIn(2);
      fireEvent.click(
        screen.getByRole("button", { name: "Fit the whole region" }),
      );
      expect(zoomLevel()).toHaveTextContent("1.0×");
      expect(labelRows).not.toHaveBeenCalled();
    });

    it("keeps the zoom and the visible range across a resize (D5)", async () => {
      const { container, rerenderChart } = await renderChart();
      zoomIn(2);
      expect(zoomLevel()).toHaveTextContent("2.3×");
      expect(focusLineX(container)).toBeCloseTo(337, 6);

      // 1,000 px: the same 226 px label column, a 774 px plot.
      rerenderChart({ width: 1000 });
      expect(zoomLevel()).toHaveTextContent("2.3×");
      expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
      // Still the window's middle.
      expect(focusLineX(container)).toBeCloseTo(387, 6);
    });
  });

  describe("density", () => {
    it("keeps the zoom and the visible range across a switch", async () => {
      const { container, rerenderChart } = await renderChart();
      zoomIn(2);
      expect(zoomLevel()).toHaveTextContent("2.3×");

      rerenderChart({ density: "compact" });
      expect(zoomLevel()).toHaveTextContent("2.3×");
      expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
      // Compact's narrower label column leaves a 696 px plot; the focus line stays in its middle.
      expect(tracksSvg(container)).toHaveAttribute("width", "696");
      expect(focusLineX(container)).toBeCloseTo(348, 6);
    });

    it("keeps the pinned gene across a switch", async () => {
      const user = userEvent.setup();
      const { container } = await renderSwitchable();
      clickAt(glyph(container, 0, 1), 10);
      await user.click(
        screen.getByRole("button", { name: "Switch to Compact density" }),
      );
      expect(
        screen.getByRole("button", { name: "Switch to Comfortable density" }),
      ).toBeInTheDocument();
      expect(within(strip()).getByText("fig|1.1.peg.2")).toBeInTheDocument();
    });

    it("keeps focus on the toggle, remounting nothing (D5)", async () => {
      const user = userEvent.setup();
      const { container } = await renderSwitchable();
      const tracks = tracksSvg(container);
      const toggle = screen.getByRole("button", {
        name: "Switch to Compact density",
      });
      await user.click(toggle);
      expect(toggle).toHaveAccessibleName("Switch to Comfortable density");
      expect(toggle).toHaveFocus();
      expect(tracksSvg(container)).toBe(tracks);
    });

    it("keeps the scroll place across a switch, in rows", async () => {
      const user = userEvent.setup();
      await renderSwitchable();
      const view = scroller();
      view.scrollTop = 40;
      fireEvent.scroll(view);
      await user.click(
        screen.getByRole("button", { name: "Switch to Compact density" }),
      );
      expect(view.scrollTop).toBeCloseTo(22.22, 2);
    });

    it("tints the hovered row across the figure in Compact", async () => {
      const { container } = await renderChart({ density: "compact" });
      fireEvent.pointerMove(figureSvg(), { clientY: 70 });
      const tints = container.querySelectorAll(
        String.raw`rect.fill-primary\/10`,
      );
      expect(tints).toHaveLength(2);
      for (const tint of tints) {
        expect(tint).toHaveAttribute("y", "60");
        expect(tint).toHaveAttribute("height", "26");
      }
      // The label column's has the 2 px edge.
      expect(
        container.querySelectorAll(String.raw`rect.fill-primary\/70`),
      ).toHaveLength(1);

      fireEvent.pointerLeave(figureSvg());
      expect(
        container.querySelectorAll(String.raw`rect.fill-primary\/10`),
      ).toHaveLength(0);
    });

    it("tints no row in Comfortable", async () => {
      const { container } = await renderChart();
      fireEvent.pointerMove(figureSvg(), { clientY: 70 });
      expect(
        container.querySelectorAll(String.raw`rect.fill-primary\/10`),
      ).toHaveLength(0);
    });
  });
});
