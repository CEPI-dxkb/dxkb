import { readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import { ChoroplethSvg, type ChoroplethHandle } from "../choropleth-svg";
import type { TopologyLike } from "../topology-utils";

const worldTopo = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public/maps/countries-110m.json"),
    "utf8",
  ),
) as TopologyLike;

const emptyGeoData: OrganismGeoDistribution = {
  countryData: {},
  countryMeta: {},
  stateData: {},
  stateMeta: {},
  countyData: {},
  countyMeta: {},
};

const identity = "matrix(1,0,0,1,0,0)";

let reducedMotion = true;
let resizeObservers: ResizeObserverCallback[] = [];

function makeProps() {
  return {
    data: emptyGeoData,
    colorScale: () => "#cccccc",
    mapState: {
      view: "world" as const,
      selectedStateFips: null,
      selectedStateName: null,
    },
    onSelectState: vi.fn(),
    onSwitchToUs: vi.fn(),
    worldTopo,
    worldTopoLoading: false,
    worldTopoError: null,
    stateTopo: null,
    stateTopoError: null,
    countyTopo: null,
    countyTopoLoading: false,
    countyTopoError: null,
    onHoverChange: vi.fn(),
    onLeaveMap: vi.fn(),
  };
}

function mapGroup(): SVGGElement {
  const group = screen
    .getByRole("img", { name: "Genome distribution map" })
    .querySelector<SVGGElement>(":scope > g");
  if (!group) throw new Error("map <g> missing");
  return group;
}

function readTransform(): string {
  return (mapGroup().getAttribute("transform") ?? "").replace(/\s+/g, "");
}

function readScale(): number {
  const match = /^matrix\(([^,]+),/.exec(readTransform());
  if (!match) throw new Error(`unparsable transform ${readTransform()}`);
  return Number(match[1]);
}

function regionPath(name: string): SVGPathElement {
  const node = mapGroup().querySelector<SVGPathElement>(
    `path[data-region="${name}"]`,
  );
  if (!node) throw new Error(`no path for ${name}`);
  return node;
}

function mapContainer(): HTMLElement {
  const container = screen.getByRole("img", {
    name: "Genome distribution map",
  }).parentElement;
  if (!container) throw new Error("map container missing");
  return container;
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  reducedMotion = true;
  resizeObservers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeObservers.push(callback);
      }
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: reducedMotion && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("ChoroplethSvg country zoom (reduced motion)", () => {
  it("zooms to a country on click", () => {
    const props = makeProps();
    render(<ChoroplethSvg {...props} />);
    expect(readTransform()).toBe(identity);
    fireEvent.click(regionPath("Germany"));
    expect(readScale()).toBeGreaterThan(5);
    expect(props.onLeaveMap).toHaveBeenCalled();
  });

  it("still switches to the US view for the USA and does not zoom", () => {
    const props = makeProps();
    render(<ChoroplethSvg {...props} />);
    fireEvent.click(regionPath("United States of America"));
    expect(props.onSwitchToUs).toHaveBeenCalledTimes(1);
    expect(readTransform()).toBe(identity);
  });

  it("zooms a country with no data, and past the old 10x ceiling for a small one", () => {
    const props = makeProps();
    render(<ChoroplethSvg {...props} />);
    fireEvent.click(regionPath("Luxembourg"));
    expect(readScale()).toBeGreaterThan(10);
    expect(readScale()).toBeLessThanOrEqual(32);
  });

  it("returns to the identity transform through the imperative reset", () => {
    const ref = createRef<ChoroplethHandle>();
    render(<ChoroplethSvg ref={ref} {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    expect(readTransform()).not.toBe(identity);
    act(() => {
      ref.current?.reset();
    });
    expect(readTransform()).toBe(identity);
  });

  it("applies the Reset zoom button at once", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(readTransform()).toBe(identity);
  });
});

describe("ChoroplethSvg country zoom (animated)", () => {
  beforeEach(() => {
    reducedMotion = false;
    vi.useFakeTimers();
  });

  it("animates to the country over several frames", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    expect(readTransform()).toBe(identity);
    advance(200);
    const midway = readScale();
    expect(midway).toBeGreaterThan(1);
    advance(1000);
    expect(readScale()).toBeGreaterThan(midway);
    expect(readScale()).toBeGreaterThan(5);
  });

  it("a Zoom in press mid-flight stops later frames from overwriting it", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    const midway = readScale();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const pressed = readTransform();
    expect(readScale()).toBeCloseTo(midway * 1.4);
    advance(1000);
    expect(readTransform()).toBe(pressed);
  });

  it("a Zoom out press mid-flight stops the animation", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(readScale()).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    const pressed = readTransform();
    advance(1000);
    expect(readTransform()).toBe(pressed);
  });

  it("a pointerdown on the map mid-flight stops the animation", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(readScale()).toBeGreaterThan(1);
    const midway = readTransform();
    fireEvent.pointerDown(mapContainer());
    advance(1000);
    expect(readTransform()).toBe(midway);
  });

  it("a Ctrl + wheel or a Safari gesture mid-flight stops the animation", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(readScale()).toBeGreaterThan(1);
    const midway = readTransform();
    fireEvent.wheel(mapContainer(), { ctrlKey: true, deltaY: -100 });
    advance(1000);
    expect(readTransform()).toBe(midway);

    fireEvent.click(regionPath("France"));
    advance(200);
    expect(readTransform()).not.toBe(midway);
    const second = readTransform();
    fireEvent(mapContainer(), new Event("gesturestart"));
    advance(1000);
    expect(readTransform()).toBe(second);
  });

  it("a plain wheel mid-flight does not stop the animation", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    const midway = readScale();
    fireEvent.wheel(mapContainer(), { deltaY: -100 });
    advance(1000);
    expect(readScale()).toBeGreaterThan(midway);
  });

  it("the imperative reset (a view switch) mid-flight cancels the animation", () => {
    const ref = createRef<ChoroplethHandle>();
    const props = makeProps();
    const { rerender } = render(<ChoroplethSvg ref={ref} {...props} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(readTransform()).not.toBe(identity);
    act(() => {
      ref.current?.reset();
    });
    rerender(
      <ChoroplethSvg
        ref={ref}
        {...props}
        mapState={{ ...props.mapState, view: "us" }}
      />,
    );
    expect(readTransform()).toBe(identity);
    advance(1000);
    expect(readTransform()).toBe(identity);
  });

  it("a resize mid-flight cancels the animation", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(readScale()).toBeGreaterThan(1);
    const midway = readTransform();
    act(() => {
      for (const callback of resizeObservers) {
        callback(
          [{ contentRect: { width: 900, height: 600 } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      }
    });
    advance(1000);
    expect(readTransform()).toBe(midway);
  });

  it("unmounting mid-flight leaves no frame scheduled", () => {
    const { unmount } = render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a second click on another country retargets from where the map is", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(200);
    expect(readScale()).toBeGreaterThan(1);
    const midway = readTransform();
    fireEvent.click(regionPath("Brazil"));
    expect(readTransform()).toBe(midway);
    advance(1000);
    const brazil = readTransform();
    expect(brazil).not.toBe(midway);
    advance(1000);
    expect(readTransform()).toBe(brazil);
  });

  it("animates the Reset zoom button back to identity", () => {
    render(<ChoroplethSvg {...makeProps()} />);
    fireEvent.click(regionPath("Germany"));
    advance(1000);
    const zoomed = readScale();
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    advance(200);
    expect(readScale()).toBeLessThan(zoomed);
    expect(readTransform()).not.toBe(identity);
    advance(1000);
    expect(readTransform()).toBe(identity);
  });
});
