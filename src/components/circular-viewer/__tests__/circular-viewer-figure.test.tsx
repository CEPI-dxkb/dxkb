vi.mock("@visx/responsive", () => ({
  useParentSize: () => ({ parentRef: { current: null }, width: 400, height: 400, resize: () => undefined }),
}));
vi.mock("@visx/event", () => ({
  localPoint: (event: { clientX: number; clientY: number }) => ({ x: event.clientX, y: event.clientY }),
}));
const download = vi.hoisted(() => ({ blob: vi.fn<(blob: Blob, fileName: string) => void>() }));
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: download.blob,
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import type { TrackData } from "@/lib/circular-viewer/drawing";
import { buildGenomeLayout } from "@/lib/circular-viewer/layout";
import { defaultTracks } from "@/lib/circular-viewer/tracks";
import { exportSvgFigure } from "@/lib/svg-figure-export";
import { CircularViewerFigure } from "../circular-viewer-figure";
import { CircularViewerTooltip } from "../circular-viewer-tooltip";

const layout = buildGenomeLayout([{ accession: "NC_1", length: 1000 }]);
const tracks = defaultTracks().filter((track) => track.id === "cds-forward");
const data = new Map<string, TrackData>([
  ["cds-forward", { status: "ready", items: { kind: "features", truncated: false, features: [{
    featureId: "PATRIC.1.1.NC_1.CDS.1.500.fwd", patricId: "fig|1.1.peg.1", accession: "NC_1",
    start: 1, end: 500, strand: "+", featureType: "CDS", product: "Widget synthase",
  }] } }],
]);

/** Moves the pointer onto a ring, `turn` of the way round clockwise from 12 o'clock (a quarter is 3 o'clock, inside the first half of the genome). */
function hoverRing(trackId: string, turn = 0.25) {
  const svg = screen.getByRole("img", { name: "Circular view of genome 1.1" });
  const ring = svg.querySelector(`[data-track="${trackId}"]`);
  const middle = (Number(ring?.getAttribute("data-inner-radius")) + Number(ring?.getAttribute("data-outer-radius"))) / 2;
  // The figure's center is (200, 200).
  const angle = turn * 2 * Math.PI;
  fireEvent.pointerMove(svg, { clientX: 200 + middle * Math.sin(angle), clientY: 200 - middle * Math.cos(angle) });
  return svg;
}

describe("CircularViewerFigure", () => {
  it("draws each track in its ring", () => {
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />);
    const ring = screen.getByRole("img").querySelector('[data-track="cds-forward"]');
    expect(ring?.getAttribute("data-state")).toBe("ready");
    expect(ring?.querySelector("path")?.getAttribute("fill")).toBe("#307D32");
    expect(ring?.querySelector("path")).not.toHaveAttribute("class");
  });

  it("draws the position labels in muted-foreground when their track has no color", () => {
    const labelTracks = defaultTracks().filter((track) => track.id === "labels");
    const longLayout = buildGenomeLayout([{ accession: "NC_1", length: 5_000_000 }]);
    render(<CircularViewerFigure genomeId="1.1" layout={longLayout} tracks={labelTracks} data={new Map()} svgRef={createRef()} />);
    const group = screen.getByRole("img").querySelector('[data-track="labels"] g[style]');
    expect(group?.querySelector("text")).not.toBeNull();
    expect((group as SVGGElement | null)?.style.getPropertyValue("--tick-color")).toBe("var(--muted-foreground)");
  });

  it("draws legacy's navy contigs in periwinkle in a dark theme, keeping the navy for light and export", () => {
    const contigTracks = defaultTracks().filter((track) => track.id === "contigs");
    const contigData = new Map<string, TrackData>([
      ["contigs", { status: "ready", items: { kind: "contigs", contigs: [{ accession: "NC_1", sequenceId: "s1", length: 1000 }] } }],
    ]);
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={contigTracks} data={contigData} svgRef={createRef()} />);
    const path = screen.getByRole("img").querySelector('[data-track="contigs"] path');
    expect(path).toHaveAttribute("fill", "#000F7D");
    expect(path).toHaveClass("dark:fill-(--dark-color)");
    expect((path as SVGPathElement | null)?.style.getPropertyValue("--dark-color")).toBe("#9FA8FF");
  });

  it("sweeps a ring's marks into view once, when its data arrives, then drops the mask", () => {
    const pending = new Map<string, TrackData>([["cds-forward", { status: "pending" }]]);
    const { rerender } = render(
      <CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={pending} svgRef={createRef()} />,
    );
    const ring = () => screen.getByRole("img").querySelector('[data-track="cds-forward"]');
    expect(ring()?.querySelector("mask")).toBeNull();

    rerender(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />);
    const mask = ring()?.querySelector("mask");
    // Four passes, each later and more opaque, for a soft edge.
    const passes = [...(mask?.querySelectorAll("circle.animate-circular-track-sweep") ?? [])];
    expect(passes.map((pass) => pass.getAttribute("opacity"))).toEqual(["0.25", String(1 / 3), "0.5", "1"]);
    expect(passes.map((pass) => (pass as SVGCircleElement).style.getPropertyValue("--sweep-delay"))).toEqual([
      "0ms", "50ms", "100ms", "150ms",
    ]);
    const sweep = passes.at(-1);
    expect(sweep).toHaveAttribute("pathLength", "1");
    // The marks show through the mask, which uncovers the whole ring.
    const masked = ring()?.querySelector(`g[mask="url(#${mask?.id ?? ""})"]`);
    expect(masked?.querySelector("path")).toHaveAttribute("fill", "#307D32");
    expect(Number(sweep?.getAttribute("r")) * 2).toBeGreaterThan(Number(ring()?.getAttribute("data-outer-radius")));

    if (!sweep) throw new Error("no sweep circle");
    // jsdom has no AnimationEvent, so React listens for the prefixed event name.
    // An earlier pass ending leaves the mask; the last one's removes it.
    fireEvent(passes[0], new Event("webkitAnimationEnd", { bubbles: true }));
    expect(ring()?.querySelector("mask")).not.toBeNull();
    fireEvent(sweep, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(ring()?.querySelector("mask")).toBeNull();
    expect(ring()?.querySelector("g[mask]")).toBeNull();

    // A new color redraws the marks without sweeping them again.
    const recolored = tracks.map((track) => ({ ...track, foreground: "#123456" }));
    rerender(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={recolored} data={data} svgRef={createRef()} />);
    expect(ring()?.querySelector("mask")).toBeNull();
    expect(ring()?.querySelector('path[fill="#123456"]')).not.toBeNull();
  });

  it("exports a ring caught mid-sweep whole, without its sweep mask", async () => {
    // Export is enabled once the requests settle, which can be before the sweep ends.
    const svgRef = createRef<SVGSVGElement>();
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={svgRef} />);
    const svg = svgRef.current;
    if (!svg) throw new Error("no figure svg");
    expect(svg.querySelector("mask")).not.toBeNull();

    download.blob.mockReset();
    exportSvgFigure(svg, "circular-genome-1.1.svg", () => null);
    const [blob] = download.blob.mock.calls.at(0) ?? [];
    if (!blob) throw new Error("nothing was downloaded");
    const root = new DOMParser().parseFromString(await blob.text(), "image/svg+xml").documentElement;
    const ring = root.querySelector('[data-track="cds-forward"]');
    expect(ring?.querySelector("mask")).toBeNull();
    expect(ring?.querySelector("[mask]")).toBeNull();
    expect(ring?.querySelector('path[fill="#307D32"]')).not.toBeNull();
  });

  it("fades a ring its eye button hides or shows, but not one drawn as it mounts", () => {
    const hidden = tracks.map((track) => ({ ...track, visible: false }));
    const { rerender } = render(
      <CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />,
    );
    const ring = () => screen.getByRole("img").querySelector('[data-track="cds-forward"]');
    expect(ring()).not.toHaveAttribute("class");
    expect(ring()).not.toHaveAttribute("display");

    // Hidden at once: the transition keeps it drawn while it fades.
    rerender(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={hidden} data={data} svgRef={createRef()} />);
    expect(ring()).toHaveClass("animate-circular-track-toggle");
    expect(ring()).toHaveAttribute("display", "none");

    rerender(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />);
    expect(ring()).toHaveClass("animate-circular-track-toggle");
    expect(ring()).not.toHaveAttribute("display");
  });

  it("shows a ring hidden as it mounts at once", () => {
    const hidden = tracks.map((track) => ({ ...track, visible: false }));
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={hidden} data={data} svgRef={createRef()} />);
    const ring = screen.getByRole("img").querySelector('[data-track="cds-forward"]');
    expect(ring).toHaveAttribute("display", "none");
    expect(ring).not.toHaveAttribute("class");
  });

  it("names the feature under the pointer and highlights it", () => {
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />);
    const svg = hoverRing("cds-forward");
    expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.1");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Widget synthase");
    expect(svg.querySelector("[data-overlay]")).not.toBeNull();
    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("places the tooltip beside the pointer through custom properties", () => {
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />);
    hoverRing("cds-forward");
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveClass("max-w-(--tip-max-w)", "translate-x-(--tip-x)", "translate-y-(--tip-y)");
    expect(tooltip.style.getPropertyValue("--tip-max-w")).toBe("min(20rem, 384px)");
    expect(tooltip.style.getPropertyValue("--tip-x")).toMatch(/^[\d.]+px$/);
    expect(tooltip.style.getPropertyValue("--tip-y")).toMatch(/^[\d.]+px$/);
  });

  describe("tooltip placement", () => {
    const hit = { trackId: "contigs", path: "", item: { kind: "contig" as const, contig: { accession: "NC_1", sequenceId: "s1", length: 1000 } } };
    const sizes = { width: 270, height: 80 };
    const sizeSpies: { mockRestore: () => void }[] = [];

    beforeEach(() => {
      sizeSpies.push(
        // The cap is written before the box is measured: a box wider than it is drawn at it.
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
          const cap = /(\d+(?:\.\d+)?)px\)$/.exec(this.style.getPropertyValue("--tip-max-w"));
          return cap ? Math.min(sizes.width, Number(cap[1])) : Number.POSITIVE_INFINITY;
        }),
        vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(sizes.height),
      );
    });
    afterEach(() => {
      for (const spy of sizeSpies.splice(0)) spy.mockRestore();
    });

    it("caps its width to the figure's less the margins and keeps a pointer at the middle of a narrow figure inside it", () => {
      render(<CircularViewerTooltip hit={hit} left={357 / 2 - 1} top={100} width={357} height={357} />);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip.style.getPropertyValue("--tip-max-w")).toBe("min(20rem, 341px)");
      const x = Number.parseFloat(tooltip.style.getPropertyValue("--tip-x"));
      expect(x).toBeGreaterThanOrEqual(8);
      expect(x).toBeLessThanOrEqual(79);
    });

    it("opens 12 px right of and below a pointer with room", () => {
      render(<CircularViewerTooltip hit={hit} left={50} top={60} width={600} height={600} />);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip.style.getPropertyValue("--tip-x")).toBe("62px");
      expect(tooltip.style.getPropertyValue("--tip-y")).toBe("72px");
    });

    it("opens left of and above a pointer near the lower right corner", () => {
      render(<CircularViewerTooltip hit={hit} left={560} top={560} width={600} height={600} />);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip.style.getPropertyValue("--tip-x")).toBe(`${String(560 - 12 - sizes.width)}px`);
      expect(tooltip.style.getPropertyValue("--tip-y")).toBe(`${String(560 - 12 - sizes.height)}px`);
    });

    it("places again when the pointer moves, though the hit is the same object", () => {
      const { rerender } = render(<CircularViewerTooltip hit={hit} left={50} top={60} width={600} height={600} />);
      rerender(<CircularViewerTooltip hit={hit} left={150} top={60} width={600} height={600} />);
      expect(screen.getByRole("tooltip").style.getPropertyValue("--tip-x")).toBe("162px");
    });
  });

  it("pins the feature's details with a link to its Feature View", () => {
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={tracks} data={data} svgRef={createRef()} />);
    const svg = hoverRing("cds-forward");
    fireEvent.click(svg, { clientX: Number(svg.querySelector('[data-track="cds-forward"]')?.getAttribute("data-inner-radius")) + 201, clientY: 200 });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("NC_1:1..500 (+)");
    expect(screen.getByRole("link", { name: "Open Feature View" })).toHaveAttribute(
      "href",
      expect.stringContaining("/feature/PATRIC.1.1.NC_1.CDS.1.500.fwd"),
    );
  });
});

describe("CircularViewerFigure from the keyboard", () => {
  const strandTracks = defaultTracks().filter(
    (track) => track.id === "cds-forward" || track.id === "cds-reverse",
  );
  const feature = (patricId: string, start: number, end: number, strand: "+" | "-") => ({
    featureId: `PATRIC.${patricId}`, patricId, accession: "NC_1",
    start, end, strand, featureType: "CDS", product: `Product of ${patricId}`,
  });
  const strandData = new Map<string, TrackData>([
    ["cds-forward", { status: "ready", items: { kind: "features", truncated: false, features: [
      feature("fig|1.1.peg.1", 1, 100, "+"), feature("fig|1.1.peg.3", 601, 700, "+"),
    ] } }],
    ["cds-reverse", { status: "ready", items: { kind: "features", truncated: false, features: [
      feature("fig|1.1.peg.2", 651, 750, "-"),
    ] } }],
  ]);
  const renderFigure = () =>
    render(<CircularViewerFigure genomeId="1.1" layout={layout} tracks={strandTracks} data={strandData} svgRef={createRef()} />);
  const figure = () => screen.getByRole("application", { name: "Genome 1.1" });
  const announcement = Object.assign(() => screen.getByText(/ of \d+: /), {
    query: () => screen.queryByText(/ of \d+: /),
  });
  async function openWithKey(user: ReturnType<typeof userEvent.setup>, key: string) {
    await user.tab();
    await user.keyboard(`{ArrowRight}${key}`);
    const dialog = screen.getByRole("dialog");
    // The dialog takes focus once it is drawn.
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
    return dialog;
  }

  it("is one tab stop, an operable widget, that shows and announces the first item on the outer ring", async () => {
    const user = userEvent.setup();
    renderFigure();
    await user.tab();
    expect(figure()).toHaveFocus();
    expect(figure()).toHaveAttribute("aria-roledescription", "circular genome figure");
    expect(figure()).toHaveAccessibleDescription(/Arrow keys move between items/);
    // The image inside stays as it was, for export and locators, and is not a tab stop;
    // its name is not the wrapper's, so it is not read out twice.
    const svg = screen.getByRole("img", { name: "Circular view of genome 1.1" });
    expect(figure()).not.toHaveAccessibleName("Circular view of genome 1.1");
    expect(svg).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.1");
    expect(svg.querySelector("[data-overlay]")).not.toBeNull();
    expect(announcement()).toHaveTextContent("CDS - FWD, 1 of 2: fig|1.1.peg.1. Product: Product of fig|1.1.peg.1.");
    expect(announcement()).toHaveAttribute("aria-live", "polite");
  });

  it("moves along a ring with Left and Right and between rings with Up and Down", async () => {
    const user = userEvent.setup();
    renderFigure();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
    expect(announcement()).toHaveTextContent("CDS - FWD, 2 of 2: fig|1.1.peg.3.");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.2");
    expect(announcement()).toHaveTextContent("CDS - REV, 1 of 1: fig|1.1.peg.2.");
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.1");
  });

  it("opens the item's details with Enter, and Escape gives focus back to the figure", async () => {
    const user = userEvent.setup();
    renderFigure();
    const dialog = await openWithKey(user, "{Enter}");
    expect(dialog).toHaveTextContent("NC_1:601..700 (+)");
    expect(screen.getByRole("link", { name: "Open Feature View" })).toHaveAttribute(
      "href",
      expect.stringContaining("/feature/PATRIC.fig"),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(figure()).toHaveFocus();
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
  });

  it("leaves the keys to the open dialog before its focus lands, so Escape does not hide the item", async () => {
    const user = userEvent.setup();
    renderFigure();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    // Held directly: the open modal hides the figure from role queries.
    const target = figure();
    // Base UI moves focus into the dialog on the next frame; a slow page can
    // take the next keys on the figure first.
    fireEvent.keyDown(target, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(target).toHaveFocus();
    fireEvent.keyDown(target, { key: "ArrowLeft" });
    fireEvent.keyDown(target, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(target).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
  });

  it("opens the item's details with Space too", async () => {
    const user = userEvent.setup();
    renderFigure();
    const dialog = await openWithKey(user, " ");
    expect(dialog).toHaveTextContent("NC_1:601..700 (+)");
  });

  it("gives focus back to the figure when the dialog's Close button is pressed, showing nothing more", async () => {
    const user = userEvent.setup();
    renderFigure();
    await openWithKey(user, "{Enter}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(figure()).toHaveFocus();
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("goes on from a clicked item once the dialog closes from the keyboard", async () => {
    const user = userEvent.setup();
    renderFigure();
    const svg = screen.getByRole("img", { name: "Circular view of genome 1.1" });
    const ring = svg.querySelector('[data-track="cds-forward"]');
    const radius = (Number(ring?.getAttribute("data-inner-radius")) + Number(ring?.getAttribute("data-outer-radius"))) / 2;
    // fig|1.1.peg.3 (601..700) sits about 65% of the way round, clockwise from 12 o'clock.
    const angle = 0.65 * 2 * Math.PI;
    await user.pointer({
      keys: "[MouseLeft]",
      target: svg,
      coords: { clientX: 200 + radius * Math.sin(angle), clientY: 200 - radius * Math.cos(angle) },
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("NC_1:601..700 (+)");
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(figure()).toHaveFocus();
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
  });

  it("hides the item with Escape until the next arrow brings it back where it was", async () => {
    const user = userEvent.setup();
    renderFigure();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    const svg = screen.getByRole("img", { name: "Circular view of genome 1.1" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(svg.querySelector("[data-overlay]")).toBeNull();
    expect(announcement.query()).toBeNull();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
  });

  describe("one source of truth for the item shown", () => {
    const svg = () => screen.getByRole("img", { name: "Circular view of genome 1.1" });
    // fig|1.1.peg.3 (601..700) sits 65% of the way round.
    const hoverPeg3 = () => hoverRing("cds-forward", 0.65);
    const ui = (t: typeof strandTracks, d: typeof strandData) => (
      <CircularViewerFigure genomeId="1.1" layout={layout} tracks={t} data={d} svgRef={createRef()} />
    );

    it("shows the keyboard's item, and Enter opens it, when focus comes after a hover", async () => {
      const user = userEvent.setup();
      renderFigure();
      hoverPeg3();
      expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
      await user.tab();
      expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.1");
      await user.keyboard("{Enter}");
      expect(screen.getByRole("dialog")).toHaveTextContent("NC_1:1..100 (+)");
    });

    it("lets the pointer take over from the keyboard's item, so Enter opens nothing unseen", async () => {
      const user = userEvent.setup();
      renderFigure();
      await user.tab();
      hoverPeg3();
      expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
      expect(announcement.query()).toBeNull();
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("drops the tooltip and highlight when the hovered track is hidden", () => {
      const view = renderFigure();
      hoverPeg3();
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      view.rerender(ui(strandTracks.map((track) => (track.id === "cds-forward" ? { ...track, visible: false } : track)), strandData));
      expect(svg().querySelector("path[data-overlay]")).toBeNull();
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("drops the tooltip when the data is replaced and nothing is under the pointer", () => {
      const view = renderFigure();
      hoverPeg3();
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      const elsewhere = new Map(strandData).set("cds-forward", {
        status: "ready",
        items: { kind: "features", truncated: false, features: [feature("fig|1.1.peg.9", 1, 100, "+")] },
      });
      view.rerender(ui(strandTracks, elsewhere));
      expect(screen.queryByRole("tooltip")).toBeNull();
      expect(svg().querySelector("[data-overlay]")).toBeNull();
    });

    it("keeps the tooltip through a recolor, since the same mark is under the pointer", () => {
      const view = renderFigure();
      hoverPeg3();
      view.rerender(ui(strandTracks.map((track) => ({ ...track, foreground: "#123456" })), strandData));
      expect(screen.getByRole("tooltip")).toHaveTextContent("fig|1.1.peg.3");
      expect(svg().querySelector("path[data-overlay]")).not.toBeNull();
    });
  });

  it("shows nothing for a focus a press gave the figure", async () => {
    const user = userEvent.setup();
    renderFigure();
    const svg = screen.getByRole("img", { name: "Circular view of genome 1.1" });
    await user.pointer({ keys: "[MouseLeft]", target: svg, coords: { clientX: 200, clientY: 200 } });
    expect(figure()).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
