import {
  canvasToSrgb,
  exportCompareRegionFigure as exportWithConverter,
  type SrgbColor,
} from "../compare-region-export";

const download = vi.hoisted(() => ({
  blob: vi.fn<(blob: Blob, fileName: string) => void>(),
}));

vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: download.blob,
}));

const svgNamespace = "http://www.w3.org/2000/svg";

/** The sRGB a browser would give these (made up; only the shape matters). */
const srgbOf: Record<string, SrgbColor> = {
  "oklch(0.73 0.12 212)": { r: 79, g: 186, b: 222, alpha: 1 },
  "oklch(71.57% 0.182 37.18 / 0.5)": { r: 242, g: 131, b: 74, alpha: 0.5 },
  "lab(62 -20 30 / 0.4)": { r: 140, g: 160, b: 100, alpha: 0.4 },
  "lch(50 40 90)": { r: 130, g: 116, b: 40, alpha: 1 },
  "color-mix(in oklab, oklch(0.8 0.1 120) 50%, transparent)": {
    r: 190,
    g: 200,
    b: 140,
    alpha: 0.5,
  },
};

/** A stand-in for the canvas converter (jsdom has no canvas): the table above, else rgb()/rgba(). */
function fakeSrgb(color: string): SrgbColor | null {
  if (color in srgbOf) return srgbOf[color];
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(color);
  if (!rgb) return null;
  const [, r, g, b, alpha = "1"] = rgb;
  return { r: Number(r), g: Number(g), b: Number(b), alpha: Number(alpha) };
}

/** The export, converting colors with `fakeSrgb`, so no test touches a canvas. */
function exportCompareRegionFigure(svg: SVGSVGElement, fileName: string) {
  exportWithConverter(svg, fileName, fakeSrgb);
}

/**
 * A small figure shaped like the chart's: a classed root (a named group), a
 * row of gene buttons, a trace overlay, the sticky ruler and label column
 * (scrolled), and labels, one in capitals.
 */
function figure(): SVGSVGElement {
  const host = document.createElement("div");
  host.innerHTML = `
    <svg class="block text-foreground" width="900" height="200" role="group" aria-label="Compared regions of 1 genome">
      <svg x="226" width="674" height="200" class="touch-pan-y cursor-grab">
        <rect class="fill-transparent" data-track-background="" width="674" height="200"></rect>
        <g role="group" aria-label="Genome 01: Escherichia coli">
          <path d="M0 0 L10 10" fill="oklch(0.73 0.12 212)" class="stroke-card" data-row="0" data-feature="0" role="button" aria-label="Focus protein, fig|1.1.peg.2" tabindex="0"></path>
        </g>
        <g data-overlay=""><rect class="fill-card opacity-80" width="674" height="170"></rect></g>
        <g data-sticky="" transform="translate(0 40)"><text class="fill-foreground">0</text></g>
      </svg>
      <g data-sticky="" transform="translate(15 0)">
        <text class="fill-foreground" style="text-transform: uppercase">focus</text>
        <text><tspan class="fill-muted-foreground">K-12</tspan></text>
        <g data-overlay=""><rect class="fill-card opacity-70"></rect></g>
      </g>
    </svg>`;
  const svg = host.querySelector("svg");
  if (!(svg instanceof SVGSVGElement)) throw new Error("no figure svg");
  document.body.append(host);
  return svg;
}

/** What the download received: its markup parsed back, the blob and the file name. */
async function downloaded() {
  const [blob, fileName] = download.blob.mock.calls.at(0) ?? [];
  if (!blob) throw new Error("nothing was downloaded");
  const markup = await blob.text();
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  return { blob, fileName, markup, root: parsed.documentElement };
}

beforeEach(() => {
  download.blob.mockReset();
  document.body.innerHTML = "";
});

describe("exportCompareRegionFigure", () => {
  it("downloads the figure as an SVG file in the SVG namespace", async () => {
    exportCompareRegionFigure(figure(), "compare-regions-fig_1.1.peg.2.svg");

    const { blob, fileName, markup, root } = await downloaded();
    expect(fileName).toBe("compare-regions-fig_1.1.peg.2.svg");
    expect(blob.type).toBe("image/svg+xml");
    expect(markup).toContain(`xmlns="${svgNamespace}"`);
    expect(root.namespaceURI).toBe(svgNamespace);
    expect(root.querySelectorAll("path")).toHaveLength(1);
  });

  it("exports a picture: the figure an image, its genes no longer buttons", async () => {
    exportCompareRegionFigure(figure(), "figure.svg");

    const { root } = await downloaded();
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-label")).toBe("Compared regions of 1 genome");
    expect(root.querySelectorAll("[role], [tabindex], [aria-label]")).toHaveLength(
      0,
    );
    // The glyph itself stays.
    expect(root.querySelector('path[data-feature="0"]')).not.toBeNull();
  });

  it("drops the hover overlays: the trace, the row tint and the rings", async () => {
    exportCompareRegionFigure(figure(), "figure.svg");

    const { root } = await downloaded();
    expect(root.querySelectorAll("[data-overlay]")).toHaveLength(0);
    // Everything else stays.
    expect(root.querySelector("[data-track-background]")).not.toBeNull();
    expect(root.querySelectorAll("text")).toHaveLength(3);
  });

  it("puts the sticky label column and ruler back in place", async () => {
    exportCompareRegionFigure(figure(), "figure.svg");

    const { root } = await downloaded();
    const sticky = [...root.querySelectorAll("[data-sticky]")];
    expect(sticky.map((group) => group.hasAttribute("transform"))).toEqual([
      false,
      false,
    ]);
  });

  it("resolves every class, the root's too, and leaves none", async () => {
    exportCompareRegionFigure(figure(), "figure.svg");

    // jsdom resolves no class (Vitest loads no CSS), so the colors themselves
    // are the browser's to check; here, that every class is gone.
    const { root, markup } = await downloaded();
    expect(root.hasAttribute("class")).toBe(false);
    expect(root.querySelectorAll("[class]")).toHaveLength(0);
    expect(markup).not.toContain("class=");
  });

  it("declares the SVG namespace once, so the file parses", async () => {
    exportCompareRegionFigure(figure(), "figure.svg");

    const { markup, root } = await downloaded();
    expect(markup.match(/xmlns=/g)).toHaveLength(1);
    expect(root.querySelector("parsererror")).toBeNull();
  });

  it("sets text the figure shows in capitals in capitals", async () => {
    exportCompareRegionFigure(figure(), "figure.svg");

    const { root } = await downloaded();
    const texts = [...root.querySelectorAll("text")].map(
      (text) => text.textContent,
    );
    expect(texts).toEqual(["0", "FOCUS", "K-12"]);
  });

  it("writes the fonts on every text and tspan, inherited ones too", async () => {
    // jsdom computes (and inherits) font-weight from a stylesheet.
    const style = document.createElement("style");
    style.textContent = ".font-medium { font-weight: 500; }";
    document.head.append(style);
    try {
      const svg = figure();
      // Unclassed text in a classed group, as the label header draws it.
      svg.insertAdjacentHTML(
        "beforeend",
        '<g class="font-medium"><text>Genome</text><text><tspan>strain</tspan></text></g>',
      );
      exportCompareRegionFigure(svg, "figure.svg");

      const { root } = await downloaded();
      const texts = [...root.querySelectorAll("text, tspan")];
      const weightOf = (content: string, tag: string) =>
        texts
          .find(
            (element) =>
              element.localName === tag && element.textContent === content,
          )
          ?.getAttribute("font-weight");
      expect(weightOf("Genome", "text")).toBe("500");
      expect(weightOf("strain", "text")).toBe("500");
      expect(weightOf("strain", "tspan")).toBe("500");
      // Every text and tspan gets the four font attributes.
      const fontAttributes = [
        "font-family",
        "font-weight",
        "font-style",
        "letter-spacing",
      ];
      for (const element of texts) {
        expect(
          fontAttributes.filter((name) => !element.hasAttribute(name)),
        ).toEqual([]);
      }
    } finally {
      style.remove();
    }
  });

  it("resolves as in the light theme when the page is dark", async () => {
    // The `dark:` variant matches anything under a dark-themed <html>, the
    // light host included. jsdom computes text-transform from a stylesheet.
    const style = document.createElement("style");
    style.textContent = String.raw`[data-theme$="-dark"] .dark\:uppercase { text-transform: uppercase; }`;
    document.head.append(style);
    document.documentElement.setAttribute("data-theme", "dxkb-dark");
    try {
      const svg = figure();
      const tspan = svg.querySelector("tspan");
      if (!tspan) throw new Error("no tspan");
      tspan.textContent = "strain";
      tspan.setAttribute("class", "fill-muted-foreground dark:uppercase");
      exportCompareRegionFigure(svg, "figure.svg");

      const { root } = await downloaded();
      expect(root.querySelector("tspan")?.textContent).toBe("strain");
    } finally {
      style.remove();
      document.documentElement.removeAttribute("data-theme");
    }
  });

  it("resolves the classes under a light-theme host, then removes it", () => {
    let hostDuringExport: Element | null = null;
    download.blob.mockImplementation(() => {
      hostDuringExport = document.querySelector('[data-theme="dxkb-light"]');
    });

    exportCompareRegionFigure(figure(), "figure.svg");

    expect(hostDuringExport).not.toBeNull();
    expect(hostDuringExport).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector('[data-theme="dxkb-light"]')).toBeNull();
  });

  it("removes its host even when the download fails", () => {
    download.blob.mockImplementation(() => {
      throw new Error("Downloads are blocked");
    });

    expect(() => {
      exportCompareRegionFigure(figure(), "figure.svg");
    }).toThrow("Downloads are blocked");
    expect(document.querySelector('[data-theme="dxkb-light"]')).toBeNull();
  });

  it("leaves the figure on the page as it was", () => {
    const svg = figure();
    exportCompareRegionFigure(svg, "figure.svg");

    expect(svg).toHaveAttribute("class", "block text-foreground");
    expect(svg.querySelectorAll("[data-overlay]")).toHaveLength(2);
    expect(svg.querySelector("[data-sticky]")).toHaveAttribute(
      "transform",
      "translate(0 40)",
    );
  });

  it("writes every color as sRGB, so tools beyond browsers read it (I2)", async () => {
    const svg = figure();
    svg.insertAdjacentHTML(
      "beforeend",
      `<g>
        <path d="M0 0" fill="lab(62 -20 30 / 0.4)" stroke="lch(50 40 90)"></path>
        <rect fill="color-mix(in oklab, oklch(0.8 0.1 120) 50%, transparent)"></rect>
        <stop stop-color="oklch(0.73 0.12 212)"></stop>
      </g>`,
    );
    exportCompareRegionFigure(svg, "figure.svg");

    const { markup, root } = await downloaded();
    expect(markup).not.toMatch(/oklch\(|lab\(|lch\(|color-mix\(/);
    const [path] = root.querySelectorAll('path[d="M0 0"]');
    expect(path.getAttribute("fill")).toBe("rgb(140, 160, 100)");
    expect(path.getAttribute("fill-opacity")).toBe("0.4");
    expect(path.getAttribute("stroke")).toBe("rgb(130, 116, 40)");
    expect(path.hasAttribute("stroke-opacity")).toBe(false);
    expect(root.querySelector("stop")?.getAttribute("stop-color")).toBe(
      "rgb(79, 186, 222)",
    );
    // The root's own color, in its style.
    expect(root.getAttribute("style")).toContain("color: rgb(0, 0, 0)");
  });

  it("moves a color's alpha into its opacity attribute, times the one there", async () => {
    const svg = figure();
    svg.insertAdjacentHTML(
      "beforeend",
      '<rect fill="oklch(71.57% 0.182 37.18 / 0.5)" fill-opacity="0.5" stroke="oklch(71.57% 0.182 37.18 / 0.5)"></rect>',
    );
    exportCompareRegionFigure(svg, "figure.svg");

    const { root } = await downloaded();
    const rect = root.querySelector('rect[fill-opacity="0.25"]');
    expect(rect?.getAttribute("fill")).toBe("rgb(242, 131, 74)");
    expect(rect?.getAttribute("stroke")).toBe("rgb(242, 131, 74)");
    expect(rect?.getAttribute("stroke-opacity")).toBe("0.5");
  });

  it("leaves none, url() and currentColor paints alone, and writes a clear one as none", async () => {
    const svg = figure();
    svg.insertAdjacentHTML(
      "beforeend",
      '<g id="paints"><path fill="none" stroke="currentColor"></path><path fill="url(#ribbon)" stroke="rgba(0, 0, 0, 0)"></path></g>',
    );
    exportCompareRegionFigure(svg, "figure.svg");

    const { root } = await downloaded();
    const [plain, patterned] = root.querySelectorAll("#paints > path");
    expect(plain.getAttribute("fill")).toBe("none");
    expect(plain.getAttribute("stroke")).toBe("currentColor");
    expect(patterned.getAttribute("fill")).toBe("url(#ribbon)");
    expect(patterned.getAttribute("stroke")).toBe("none");
  });
});

describe("canvasToSrgb", () => {
  const spies: { mockRestore: () => void }[] = [];
  afterEach(() => {
    // The config only clears mocks: put the real canvas and CSS.supports back.
    for (const spy of spies.splice(0)) spy.mockRestore();
  });

  function stubCanvas(pixel: number[]) {
    const context = {
      fillStyle: "",
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(pixel) })),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const supports = vi
      .spyOn(CSS, "supports")
      .mockImplementation(
        (_property: string, value?: string) => value !== "not a color",
      );
    spies.push(getContext, supports);
    return { context, getContext };
  }

  it("reads a color off a 1×1 canvas, each distinct color once", () => {
    const { context, getContext } = stubCanvas([242, 131, 74, 128]);
    const toSrgb = canvasToSrgb();
    const color = "oklch(71.57% 0.182 37.18 / 0.5)";

    expect(toSrgb(color)).toEqual({ r: 242, g: 131, b: 74, alpha: 0.502 });
    expect(context.fillStyle).toBe(color);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1, 1);
    expect(toSrgb(color)).toEqual({ r: 242, g: 131, b: 74, alpha: 0.502 });
    expect(context.getImageData).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("answers nothing for what is not a color", () => {
    const { context } = stubCanvas([0, 0, 0, 255]);
    expect(canvasToSrgb()("not a color")).toBeNull();
    expect(context.getImageData).not.toHaveBeenCalled();
  });

  it("converts nothing without a 2D context, looking for one once", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null);
    spies.push(getContext);
    const toSrgb = canvasToSrgb();
    expect(toSrgb("oklch(0.73 0.12 212)")).toBeNull();
    expect(toSrgb("lab(62 -20 30)")).toBeNull();
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});
